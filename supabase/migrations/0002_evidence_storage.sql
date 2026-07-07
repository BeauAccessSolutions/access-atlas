-- =============================================================================
-- 0002_evidence_storage.sql — storage bucket for attribute evidence photos (§4).
--
-- Objective attribute claims carry photo evidence (§4: "Photos are the evidence
-- base"). Photos are uploaded ONLY by trusted server code (the confirmations
-- endpoint), which re-encodes them through sharp first to STRIP EXIF/GPS
-- metadata before they ever land here (§6 privacy — a raw phone photo leaks
-- location and device). Never upload a user's raw file directly to this bucket.
--
-- Public-read: an entrance/ramp/restroom-doorway photo is evidence meant to be
-- seen; it carries no personal data once EXIF is stripped. Writes are NOT public
-- (no anon insert policy) — the service role bypasses RLS to write.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', true)
on conflict (id) do nothing;

-- Public read of evidence objects (bucket is public, but be explicit).
create policy "public read: evidence objects"
  on storage.objects for select
  using (bucket_id = 'evidence');

-- No insert/update/delete policies for anon/authenticated: uploads flow through
-- the service role only, until the Keycloak-backed contributor identity lands
-- and we can scope writes to an authenticated contributor.
