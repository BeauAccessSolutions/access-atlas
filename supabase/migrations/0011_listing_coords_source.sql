-- =============================================================================
-- 0011_listing_coords_source.sql — record HOW a listing's coordinates were set,
-- so the "sort by distance" enhancement can be honest about precision (§4).
--
-- Coordinates now arrive two ways (submit flow, §13):
--   * 'exact'       — the contributor typed a precise latitude/longitude.
--   * 'approximate' — derived from the listing's ZIP centroid (src/lib/zip-
--     centroids.ts) because they didn't. Neighborhood-level, not a real address.
-- null = no coordinates at all.
--
-- Why track it: a ZIP centroid puts every listing in that ZIP at the SAME point,
-- so a distance of "0.3 mi" from one is a rough estimate, not a measurement. We
-- label those "approximate" in the UI rather than imply precision we don't have
-- (§4 honest labeling). It also lets a future precise geocode UPGRADE an
-- approximate coordinate without clobbering a contributor's exact one.
--
-- Additive + orthogonal to the consensus formula — does NOT touch
-- attribute_claims / confirmations / attribute_claim_status (§4/§13 lockstep
-- unaffected).
-- =============================================================================

alter table listings
  add column coords_source text
    check (coords_source in ('exact', 'approximate'));

comment on column listings.coords_source is
  'How lat/lng were set: exact (contributor-entered) or approximate (ZIP centroid, §13). null = no coordinates. Drives honest "approximate location" labeling (§4).';
