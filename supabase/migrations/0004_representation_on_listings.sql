-- =============================================================================
-- 0004_representation_on_listings.sql — the representation axis belongs to the
-- business, not just to providers (Gap A from research/seed-nys/gaps.md).
--
-- disabled_owned / disabled_led (§1 representation, §12 definitions) describe WHO
-- OWNS / LEADS a business — a property that is independent of whether the listing
-- is a place or a provider. A disabled-owned CAFE is a `place` (e.g. Fly By Cafe,
-- an SDVOB-certified cafe/B&B), and today it has nowhere to record that because
-- the flags live on provider_profiles (provider-only).
--
-- Fix: hoist the two flags onto the shared `listings` entity so both kinds carry
-- them. disability_literate stays on provider_profiles — THAT one is genuinely
-- provider-only (it's about competently serving disabled patients, §8), not an
-- ownership fact. This is additive + orthogonal to the consensus formula: it does
-- NOT touch attribute_claims, confirmations, or the attribute_claim_status view
-- (§4/§13), so the safety-critical lockstep is unaffected.
-- =============================================================================

alter table listings
  add column disabled_owned boolean not null default false, -- self-attested >= 51% disabled ownership (§12)
  add column disabled_led   boolean not null default false; -- self-attested disabled primary leadership (§12)

-- Carry existing provider values up before dropping them, so no attestation is lost.
update listings l
  set disabled_owned = pp.disabled_owned,
      disabled_led   = pp.disabled_led
  from provider_profiles pp
  where pp.listing_id = l.id;

-- Single source of truth: remove the now-duplicated flags from provider_profiles.
alter table provider_profiles
  drop column disabled_owned,
  drop column disabled_led;

comment on column listings.disabled_owned is
  'Self-attested: a disabled person holds >= 51% ownership (§12). Applies to places AND providers.';
comment on column listings.disabled_led is
  'Self-attested: a disabled person holds primary leadership / decision-making (§12). Applies to places AND providers.';
