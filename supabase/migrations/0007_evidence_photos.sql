-- =============================================================================
-- 0007_evidence_photos.sql — make the evidence base VISIBLE (§4: "Photos are
-- the evidence base") without weakening the confirmations privacy boundary.
--
-- Two additions:
--
-- 1. confirmations.photo_alt + photo_thumb_url
--    * photo_alt — the contributor's own description of what their photo shows.
--      REQUIRED whenever a photo is attached (enforced by the endpoint): an
--      evidence photo a blind or low-vision user can't read is not evidence for
--      them (§5; a11y crossover audit Tier 3 "alt required on upload").
--    * photo_thumb_url — a small (~320px) thumbnail generated at upload time so
--      listing pages can show evidence within the low-bandwidth budget (§5);
--      the full photo is one click away.
--
-- 2. evidence_photos view — the ONLY public read path for photo evidence.
--    confirmations rows stay unreadable (0001: a person's tag set + visit dates
--    could re-identify them, §6). This view exposes EXCLUSIVELY the photo
--    fields — never notes, never identity tags, never contributor ids. The
--    photo objects themselves are already public by URL (0002: the evidence
--    bucket is public-read, EXIF-stripped), so this reveals nothing new — it
--    just lets pages FIND them. `agrees` is included so dissent evidence is
--    labeled honestly ("problem reported"), and observed_on is a DATE (never a
--    timestamp) — coarse on purpose.
--
-- Orthogonal to the consensus formula — does NOT touch attribute_claim_status
-- (§4/§13 lockstep unaffected).
-- =============================================================================

alter table confirmations
  add column photo_alt text,
  add column photo_thumb_url text;

comment on column confirmations.photo_alt is
  'Contributor-written description of their evidence photo. Required with a photo (endpoint-enforced) — alt text is part of the evidence (§5).';
comment on column confirmations.photo_thumb_url is
  'Small thumbnail generated at upload (§5 low-bandwidth); full photo at photo_url.';

-- The public read path for evidence photos. SECURITY DEFINER on purpose (the
-- same deliberate choice as attribute_claim_status in 0001): it must read
-- confirmations rows that RLS hides, and expose only these columns.
create view evidence_photos as
select
  ac.listing_id,
  f.claim_id,
  f.photo_url,
  f.photo_thumb_url,
  f.photo_alt,
  f.agrees,
  -- DATE, never a timestamp — coarse on purpose (§6 data minimization; the
  -- upload instant could correlate a photo back to a person's visit).
  coalesce(f.visited_on, f.created_at::date) as observed_on
from confirmations f
join attribute_claims ac on ac.id = f.claim_id
where f.photo_url is not null;

grant select on evidence_photos to anon, authenticated;
