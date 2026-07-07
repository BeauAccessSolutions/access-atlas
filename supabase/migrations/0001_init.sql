-- =============================================================================
-- 0001_init.sql — core schema
--
-- This schema encodes the project constitution (CLAUDE.md). Read §4 (validation
-- model) and §6 (privacy) before changing anything here. The rules below are
-- SAFETY-CRITICAL: a wrongly-"verified" access claim can strand or endanger a
-- person. Bias every ambiguous choice toward caution.
--
-- Design principles baked in:
--   * Attribute-level validation, never an overall star average (§4, §14).
--   * The ONLY allowed labeling vocabulary is the attribute_state enum below.
--   * Data minimization: we never store a person's disability *type* (§6).
--     Reviewer identity tags are COARSE, OPTIONAL, and access-oriented only.
--   * Lived experience is weighted (§2, §4) via relevant_identity_tag.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- A listing is a provider OR a place. Schema is shared so the validation
-- machinery (the moat) is uniform across both. (§13 open decision: one vs. two
-- submission flows — the *data* is unified regardless of the UI choice.)
create type listing_kind as enum ('provider', 'place');

-- What sort of claim an attribute is. Drives who can meaningfully confirm it.
create type attribute_category as enum (
  'facility_objective',    -- binary, photo-verifiable (§8b): "entrance has zero steps"
  'provider_behavior',     -- first-person visit report (§8c): "communicated directly with me"
  'provider_self_attested' -- owner affirmation (§8a, ADHCE-mapped): not community-verifiable
);

-- The ONLY allowed labeling vocabulary (§4). Do not add "verified" or
-- "high confidence" strings anywhere else in the codebase; derive from here.
--   self_reported          -> UI: "self-reported / awaiting verification"
--   community_confirmations -> UI: "N community confirmations"
--   community_verified     -> UI: "community-verified" (>= 3 independent confirmations)
--   sourced                -> UI: "sourced" — the ONLY state that may say "high confidence"
--   disputed               -> UI: "disputed — under re-review" (a credible dissent froze it)
create type attribute_state as enum (
  'self_reported',
  'community_confirmations',
  'community_verified',
  'sourced',
  'disputed'
);

-- ---------------------------------------------------------------------------
-- Contributors (pseudonymous — §6)
--
-- We store the minimum. No email is required here; auth (if any) lives in
-- Supabase's auth schema and is intentionally decoupled. `pseudonym` is a
-- display handle, not a real name. We do NOT store disability type, ever.
-- ---------------------------------------------------------------------------
create table contributors (
  id          uuid primary key default gen_random_uuid(),
  pseudonym   text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Listings (providers + places)
-- ---------------------------------------------------------------------------
create table listings (
  id            uuid primary key default gen_random_uuid(),
  kind          listing_kind not null,
  name          text not null,
  summary       text,
  -- Address kept coarse; precise geocoding is optional because the map is a
  -- progressive enhancement over an equivalent list view (§5). lat/lng nullable.
  street        text,
  city          text,
  region        text,        -- e.g., 'Erie County' — drives the WNY-first rollout (§3)
  postal_code   text,
  lat           double precision,
  lng           double precision,
  submitted_by  uuid references contributors (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index listings_kind_idx on listings (kind);
create index listings_region_idx on listings (region);

-- Provider-only profile. Disabled-owned / disabled-led are SELF-ATTESTED only —
-- never require medical proof (§6, §12). A provider may be literate, owned, both,
-- or neither; these are independent axes (§1).
create table provider_profiles (
  listing_id          uuid primary key references listings (id) on delete cascade,
  disability_literate boolean not null default false, -- serves disabled people well (ADHCE, §8)
  disabled_owned      boolean not null default false, -- self-attested representation (§1)
  disabled_led        boolean not null default false, -- self-attested representation (§1)
  -- ADHCE-mapped affirmation checkboxes captured at sign-up (§8a). Free-form
  -- jsonb so the affirmation set can evolve without a migration.
  self_attestations   jsonb not null default '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- Attribute catalog — the specific, separately-validated claims (§4, §8)
--
-- Never collapse these into one score. Each row is one thing a person can
-- confirm from their own visit.
-- ---------------------------------------------------------------------------
create table attribute_definitions (
  id                   uuid primary key default gen_random_uuid(),
  key                  text not null unique,         -- 'entrance_step_free'
  label                text not null,                -- 'Step-free entrance'
  category             attribute_category not null,
  applies_to_kind      listing_kind,                 -- null = applies to both
  -- The structured question a confirmer answers FROM THEIR OWN VISIT. This is
  -- how we avoid one-click "me too" agreement (§4, anti trigger-happy).
  question_text        text not null,
  requires_photo       boolean not null default true, -- evidence base (§4, §8b)
  -- Time-decay (§4): physical facts expire. Prompt re-confirmation after this
  -- many days. Working defaults; per-attribute cadence is an open decision (§13).
  reverify_interval_days integer not null default 365,
  -- Whose lived experience is weighted for THIS attribute (§4). e.g. a
  -- 'wheelchair_user' tag is weighted for step-free access. Coarse + optional.
  -- null = no specific identity is privileged for this attribute.
  relevant_identity_tag text
);

-- One claim per (listing, attribute): the assertion that this attribute holds.
-- Confirmations accrue against it. `sourced` flips the claim to the sourced
-- state (backed by certification/audit/partner — §4).
create table attribute_claims (
  id               uuid primary key default gen_random_uuid(),
  listing_id       uuid not null references listings (id) on delete cascade,
  attribute_def_id uuid not null references attribute_definitions (id) on delete restrict,
  asserted_value   boolean not null default true,   -- what is being claimed (usually "yes, present")
  sourced          boolean not null default false,  -- backed by audit/cert/partner (§4)
  sourced_note     text,                             -- what the source is (audit name, partner org)
  created_at       timestamptz not null default now(),
  unique (listing_id, attribute_def_id)
);

create index attribute_claims_listing_idx on attribute_claims (listing_id);

-- First-person confirmations. A confirmation is a person answering the
-- attribute's structured question from THEIR OWN visit — not a "me too" (§4).
--   agrees = true  -> their visit confirms the claim's asserted_value
--   agrees = false -> a dissent ("this is NOT accessible") — freezes the claim (§4)
-- `reviewer_identity_tags` are coarse, optional, access-oriented, and never
-- publicly tied to the person (§6). Used only for weighting (§4).
create table confirmations (
  id                    uuid primary key default gen_random_uuid(),
  claim_id              uuid not null references attribute_claims (id) on delete cascade,
  contributor_id        uuid not null references contributors (id) on delete cascade,
  agrees                boolean not null,
  observed_note         text,              -- optional free-text from the visit
  photo_url             text,              -- evidence (§4) — required for objective attributes at the app layer
  reviewer_identity_tags text[] not null default '{}',
  visited_on            date,
  created_at            timestamptz not null default now(),
  -- Independence (§4): one confirmation per person per claim. Prevents a single
  -- contributor padding the consensus count.
  unique (claim_id, contributor_id)
);

create index confirmations_claim_idx on confirmations (claim_id);

-- ---------------------------------------------------------------------------
-- Derived status view — the single source of truth for labeling.
--
-- THE WORKING VALIDATION FORMULA (§4; exact numbers are open decisions, §13):
--   * Any first-person dissent           -> 'disputed' (freeze, pending re-review).
--     Dissent takes precedence over everything, including 'sourced'. The cost of
--     a false positive is borne by a user's body — bias toward caution (§4).
--   * sourced flag                        -> 'sourced'.
--   * >= 3 independent agreeing confirmations, AND (if the attribute privileges
--     a lived-experience tag) >= 1 of them carries that tag -> 'community_verified'.
--   * >= 1 agreeing confirmation          -> 'community_confirmations'.
--   * otherwise                           -> 'self_reported'.
--
-- Staleness (time-decay, §4) is reported alongside state so the UI can surface
-- "last confirmed" and prompt re-confirmation. A stale claim is NOT auto-verified.
-- ---------------------------------------------------------------------------
create view attribute_claim_status as
select
  c.id                                                            as claim_id,
  c.listing_id,
  c.attribute_def_id,
  d.key                                                           as attribute_key,
  d.label,
  d.category,
  d.relevant_identity_tag,
  d.reverify_interval_days,
  c.sourced,
  c.sourced_note,
  count(f.*) filter (where f.agrees)                              as agree_count,
  count(f.*) filter (where not f.agrees)                          as dissent_count,
  count(f.*) filter (
    where f.agrees
      and d.relevant_identity_tag is not null
      and d.relevant_identity_tag = any (f.reviewer_identity_tags)
  )                                                               as weighted_agree_count,
  max(f.created_at) filter (where f.agrees)                       as last_confirmed_at,
  case
    when max(f.created_at) filter (where f.agrees) is null then null
    else max(f.created_at) filter (where f.agrees)
         < now() - make_interval(days => d.reverify_interval_days)
  end                                                             as is_stale,
  case
    -- Dissent freezes first — safety over everything (§4).
    when count(f.*) filter (where not f.agrees) > 0 then 'disputed'::attribute_state
    when c.sourced then 'sourced'::attribute_state
    when count(f.*) filter (where f.agrees) >= 3
         and (
           d.relevant_identity_tag is null
           or count(f.*) filter (
                where f.agrees
                  and d.relevant_identity_tag = any (f.reviewer_identity_tags)
              ) >= 1
         )
      then 'community_verified'::attribute_state
    when count(f.*) filter (where f.agrees) >= 1 then 'community_confirmations'::attribute_state
    else 'self_reported'::attribute_state
  end                                                             as state
from attribute_claims c
join attribute_definitions d on d.id = c.attribute_def_id
left join confirmations f on f.claim_id = c.id
group by c.id, d.id;

-- ---------------------------------------------------------------------------
-- Row Level Security (§6)
--
-- Browsing is public and account-free, so listings/claims/status are readable
-- by anyone. WRITE policies are intentionally NOT granted here — contribution
-- auth is a deliberate, pseudonymous design still being specified (§6, §13).
-- Writes go through trusted server code (service role) until that lands, rather
-- than opening anon writes now. Do not add permissive write policies casually.
-- ---------------------------------------------------------------------------
alter table listings              enable row level security;
alter table provider_profiles     enable row level security;
alter table attribute_definitions enable row level security;
alter table attribute_claims      enable row level security;
alter table confirmations         enable row level security;
alter table contributors          enable row level security;

create policy "public read: listings"
  on listings for select using (true);
create policy "public read: provider_profiles"
  on provider_profiles for select using (true);
create policy "public read: attribute_definitions"
  on attribute_definitions for select using (true);
create policy "public read: attribute_claims"
  on attribute_claims for select using (true);

-- NOTE: confirmations and contributors are deliberately NOT publicly readable
-- as full rows — a person's set of identity tags + visit dates could re-identify
-- them (§6). Aggregate counts are exposed via attribute_claim_status instead.
-- Grant read on the view's underlying aggregation, not the raw rows.
create policy "public read: confirmation aggregates via view only"
  on confirmations for select using (false);
create policy "no public read: contributors"
  on contributors for select using (false);

-- The status view is deliberately left as a SECURITY DEFINER view (we do NOT
-- set security_invoker) so it can aggregate confirmations into counts while the
-- raw confirmation rows remain unreadable (the RLS policies above deny row-level
-- select). This is the privacy boundary: expose "3 confirmations", never the 3
-- people. Grant read on the aggregate view only.
grant select on attribute_claim_status to anon, authenticated;
