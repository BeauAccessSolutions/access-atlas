-- =============================================================================
-- 0017_per_flag_coverage_provenance.sql — give every coverage fact its OWN
-- source and date, and delete the guard that existed only because it didn't.
--
-- THE PROBLEM, which showed up twice. Migration 0014 stored ONE
-- coverage_source / coverage_as_of / coverage_note for the whole provider —
-- right when the record is written in a single go, wrong the moment anything
-- updates part of it:
--
--   * 0016 (the single-record write path) hit it as a BUG, caught only by
--     exercising it against real Postgres: updating just `--medicare` from a
--     directory relabelled the practice's own self-attested panel status as
--     "From: NY State of Health directory" — a provenance nobody gave it. That
--     is migration 0012's failure (asserting an attestation nobody made) in a
--     new place.
--   * The bulk call sheet hit it again as FRICTION: because a blank cell means
--     "leave unchanged", any sheet recording a new call could silently relabel
--     the facts it didn't mention, so `carriedOverFlags` had to reject the row
--     and make the operator re-state facts they never asked about.
--
-- Twice is a wrong model, not two coincidences. `carriedOverFlags` was a guard
-- against our own schema. This removes the schema problem, and the guard goes
-- with it.
--
-- THE SHAPE. One row per (provider, fact), each carrying its own provenance —
-- the same shape as attribute_claims, and for the same reason: a fact is a
-- thing with its own evidence, not a column on a form.
--
-- UNKNOWN IS NOW THE ABSENCE OF A ROW, and this is the real prize. 0014 had to
-- reason about three-valued booleans plus a nullable source plus a nullable
-- date, and presentCoverage() had a four-branch fail-safe refusing to publish
-- anything missing a piece. Here `source` and `as_of` are NOT NULL, so **a fact
-- that cannot be published cannot be stored**. The fail-safe moves out of
-- runtime code and into the schema, where it cannot be forgotten. Clearing a
-- fact is deleting its row.
--
-- BACKFILL DROPS THE UNPUBLISHABLE. A flag set with no source or no date could
-- never be rendered (0014's presenter refused it), so it was invisible data.
-- Carrying it over would mean inventing the provenance it never had, so those
-- rows are deliberately not migrated. This is a lossy migration ON PURPOSE, and
-- it only loses what the site could never show.
-- =============================================================================

create table provider_coverage_facts (
  listing_id uuid not null references listings (id) on delete cascade,
  -- Which fact. Free text against a small app-side vocabulary (src/lib/coverage.ts)
  -- rather than an enum, so a future fact is a data change, not a migration —
  -- the same choice listings.category made (0005).
  key        text not null,
  value      boolean not null,          -- true / false. "Unknown" is NO ROW.
  -- Provenance, per fact, NOT NULL. This is the whole point of the migration:
  -- an unpublishable fact is now unstorable.
  source     text not null check (source in ('self_attested', 'sourced')),
  as_of      date not null,
  -- Citation for a `sourced` fact (§7 — a sourced claim must be checkable).
  -- Not enforced NOT NULL here because it is meaningless for self_attested;
  -- the write path requires it when source = 'sourced'.
  note       text,
  updated_at timestamptz not null default now(),
  primary key (listing_id, key)
);

create index provider_coverage_facts_listing_idx on provider_coverage_facts (listing_id);

comment on table provider_coverage_facts is
  'Provider coverage: panel status, Medicaid/Medicare, telehealth availability. One row per (provider, fact), each with its OWN source and date — NOT NULL, so a fact that cannot be published cannot be stored. Unknown = no row. Deliberately outside the §4 consensus model: these are attested facts with a date, never community-validated claims.';
comment on column provider_coverage_facts.key is
  'Fact key from the app-side vocabulary in src/lib/coverage.ts (accepting_new_patients, accepts_medicaid, accepts_medicare, offers_telehealth). Text, not an enum, so a new fact is a data change.';
comment on column provider_coverage_facts.as_of is
  'When this specific fact was confirmed with the practice. Per-fact: recording a new Medicare answer must never restamp the panel status (migration 0017).';

-- Backfill: one row per publishable flag. The WHERE clause is the honest part —
-- a flag with no source or no date was never renderable, so it is dropped
-- rather than given provenance it never had.
insert into provider_coverage_facts (listing_id, key, value, source, as_of, note)
select p.listing_id, f.key, f.value, p.coverage_source, p.coverage_as_of, p.coverage_note
from provider_profiles p
cross join lateral (values
  ('accepting_new_patients', p.accepting_new_patients),
  ('accepts_medicaid',       p.accepts_medicaid),
  ('accepts_medicare',       p.accepts_medicare),
  ('offers_telehealth',      p.offers_telehealth)
) as f(key, value)
where f.value is not null
  and p.coverage_source is not null
  and p.coverage_as_of is not null;

-- One source of truth: leaving the old columns would let the two drift, and the
-- next reader would have to work out which one the app trusts.
alter table provider_profiles
  drop column accepting_new_patients,
  drop column accepts_medicaid,
  drop column accepts_medicare,
  drop column offers_telehealth,
  drop column coverage_source,
  drop column coverage_as_of,
  drop column coverage_note;

-- Same posture as every other table: public read, service_role writes. RLS is
-- not a GRANT — both are required (CLAUDE.md §14b).
alter table provider_coverage_facts enable row level security;
create policy "public read: provider_coverage_facts"
  on provider_coverage_facts for select using (true);
grant select on provider_coverage_facts to anon, authenticated;
grant select, insert, update, delete on provider_coverage_facts to service_role;

-- New table + dropped columns: PostgREST caches the schema and would keep
-- serving the old shape until told otherwise (CLAUDE.md §14b).
notify pgrst, 'reload schema';
