-- =============================================================================
-- 0012_representation_provenance.sql — say WHERE a representation claim came
-- from, so the UI can stop asserting an attestation nobody made (§2, §4, §12).
--
-- THE BUG THIS FIXES. `listings.disabled_owned` / `disabled_led` are plain
-- booleans, and every UI surface renders a true one as "(self-attested)". For
-- the seeded WNY data that is FALSE: nobody attested. Production publicly
-- labeled `Apnea Care Inc` "Disabled-owned (self-attested)" on the strength of a
-- federal SBA SDVOSB certification, while the seed record's own review note read
-- "NEEDS OWNER SELF-ATTESTATION AT ONBOARDING". All 8 seeded disabled-owned
-- listings were in that state, plus several disabled-led ones the seed had
-- explicitly flagged `disabled_led_needs_confirmation`.
--
-- The label was wrong in BOTH directions: it claimed an attestation that did not
-- exist, while under-describing evidence that is actually stronger than
-- self-attestation (a government certification is §4's `sourced` class — the one
-- state permitted to carry higher confidence).
--
-- THE FIX. A boolean cannot carry provenance, so add it. The vocabulary matches
-- §4's existing states rather than inventing a parallel one:
--   * 'self_attested' — the owner/org told US, through the contribute flow.
--                       This is the ONLY value that may render "self-attested".
--   * 'sourced'       — backed by a certification, audit, or partner org, named
--                       in representation_note so a reader can check it.
--   * NULL            — provenance unknown. FAIL-SAFE: the UI publishes NOTHING
--                       for that axis. A bare `disabled_owned = true` with no
--                       source is no longer publishable, which means this
--                       migration alone makes production honest even before the
--                       seed is re-imported.
--
-- Deliberately NOT a NOT NULL constraint on (flag = true -> source not null):
-- existing rows would have to be backfilled with a guess, and guessing is the
-- exact failure being fixed. The fail-safe read at the UI layer is the
-- enforcement instead, and it degrades toward silence rather than toward a claim.
--
-- Nothing here touches the attribute consensus formula (§4/§13) — representation
-- is orthogonal to attribute validation, as migration 0004 established.
-- =============================================================================

alter table listings
  add column disabled_owned_source text
    check (disabled_owned_source in ('self_attested', 'sourced')),
  add column disabled_led_source text
    check (disabled_led_source in ('self_attested', 'sourced')),
  add column representation_note text;

comment on column listings.disabled_owned_source is
  'Provenance for disabled_owned: self_attested (the owner told us) or sourced (certification/audit/partner, named in representation_note). NULL = unknown; the UI must publish nothing (§4 honest labeling).';
comment on column listings.disabled_led_source is
  'Provenance for disabled_led: self_attested or sourced. NULL = unknown; the UI must publish nothing (§4 honest labeling).';
comment on column listings.representation_note is
  'Plain-language citation for a sourced representation claim, e.g. "NYS OGS SDVOB certification". Shown to users so the claim is checkable (§7). NULL for self-attested claims.';

-- Existing rows keep source NULL on purpose: whatever is already flagged has
-- unknown provenance until the importer re-runs with the evidence, and unknown
-- provenance must read as "not claimed", never as "attested".
