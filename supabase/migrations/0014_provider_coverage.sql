-- =============================================================================
-- 0014_provider_coverage.sql — the blockers that fire BEFORE accessibility.
--
-- THE GAP. A provider can be perfectly accessible and still be a wasted trip:
-- the panel is closed, or they don't take your coverage. For disabled people
-- those are the first two gates, and today the app answers neither — a visitor
-- reads a beautifully validated step-free entrance, travels there, and is turned
-- away at the desk. §8's competence axis says nothing about whether you can be
-- seen at all.
--
-- WHY THIS IS NOT AN ATTRIBUTE (deliberately outside §4). Everything in
-- attribute_definitions is a first-person visit fact validated by >= 3
-- independent confirmations. Coverage is a different shape in three ways:
--   1. It is not first-person-verifiable in a way that generalizes. "They took
--      MY Medicaid" says nothing about the next person's plan.
--   2. It changes monthly (panels close, contracts lapse), not on the 365-day
--      re-verification cadence the consensus formula assumes.
--   3. Its authority is the provider's own office, not a visitor. Running it
--      through community consensus would invent agreement that doesn't exist.
-- So: no claims, no confirmations, no `community_verified`. Nothing here touches
-- attribute_claim_status. These are attested facts with a date on them.
--
-- NULLABLE BOOLEANS, ON PURPOSE. The existing provider_profiles flags are
-- `not null default false`, which conflates "no" with "nobody asked" — the
-- ambiguity migration 0012 then had to work around. Here all three are nullable
-- and three-valued:
--   true  = yes, and we can say so
--   false = NO — a real, publishable, useful answer ("does not accept Medicaid"
--           saves exactly the trip this migration exists to prevent)
--   NULL  = unknown. The UI publishes NOTHING (§4 fail-safe).
--
-- PROVENANCE + TIME. `coverage_source` reuses 0012's vocabulary rather than
-- inventing a parallel one. `coverage_as_of` is required in practice for
-- anything publishable: a coverage fact with no date is not publishable at all,
-- because "accepts Medicaid" with no date is exactly the unverifiable trust
-- claim §14 forbids. Presentation always renders the date, and marks the fact
-- stale past COVERAGE_STALE_DAYS (180 — see src/lib/coverage.ts; half the
-- attribute cadence, because these decay far faster).
--
-- WHY ONLY MEDICAID AND MEDICARE, and no commercial plan list. Those two are
-- nationally defined, near-binary, and disproportionately how disabled people
-- are covered (SSDI leads to Medicare; Medicaid carries HCBS and long-term
-- supports). Commercial plan networks are fragmented, tiered, renamed yearly and
-- differ by employer group — storing them would produce confident wrong answers
-- about money. That question is asked, never asserted: it lives on the ask-ahead
-- page instead.
--
-- Not a constraint that a true/false value implies a source + date: existing
-- rows would need a backfilled guess, and guessing is the failure being avoided.
-- The fail-safe read at the UI layer is the enforcement, and it degrades toward
-- silence rather than toward a claim (same choice, same reasoning, as 0012).
-- =============================================================================

alter table provider_profiles
  add column accepting_new_patients boolean,
  add column accepts_medicaid       boolean,
  add column accepts_medicare       boolean,
  add column coverage_source text
    check (coverage_source in ('self_attested', 'sourced')),
  add column coverage_as_of date,
  add column coverage_note text;

comment on column provider_profiles.accepting_new_patients is
  'Three-valued: true = taking new patients, false = panel closed (a real answer worth publishing), NULL = unknown, publish nothing (§4).';
comment on column provider_profiles.accepts_medicaid is
  'Three-valued, as accepting_new_patients. NOT a §4 attribute: no community consensus applies.';
comment on column provider_profiles.accepts_medicare is
  'Three-valued, as accepting_new_patients. NOT a §4 attribute: no community consensus applies.';
comment on column provider_profiles.coverage_source is
  'Provenance for the three coverage flags: self_attested (the practice told us) or sourced (named in coverage_note). NULL = unknown; the UI must publish nothing.';
comment on column provider_profiles.coverage_as_of is
  'The date these coverage facts were last confirmed with the practice. Required for anything publishable — an undated coverage claim is not publishable (§14). Always rendered; drives the staleness warning.';
comment on column provider_profiles.coverage_note is
  'Plain-language citation for a sourced coverage claim, e.g. "NY State of Health provider directory, June 2026". Shown so the claim is checkable (§7).';
