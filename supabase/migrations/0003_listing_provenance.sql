-- =============================================================================
-- 0003_listing_provenance.sql — provenance + idempotency for imported listings.
--
-- Why: the WNY seed data (research/seed-nys/) is SECONDARY-SOURCE, self-reported
-- data (§4, §7). Two needs follow from that:
--
--   1. Honest labeling (§7). A seeded listing must carry WHERE it came from, so
--      the "self-reported / community-sourced" disclaimer is checkable, not a
--      vibe. `source_url` is that pointer.
--   2. Idempotent re-import. The importer (scripts/seed-import.mjs) must be safe
--      to re-run as the dataset is corrected during review, without creating
--      duplicate listings. `source_ref` is a stable natural key the importer
--      upserts on (unique where present).
--
-- Both are NULL for community-submitted listings (the contribute flow) — this
-- only describes rows that came from a curated import. Nothing here touches the
-- validation formula or the attribute_claim_status view (§4/§13): imported
-- listings still start `self_reported` and earn their state the same way.
-- =============================================================================

alter table listings
  add column source_ref text,   -- stable importer key, e.g. 'wnyil:place:elmwood-village-cafe'
  add column source_url text;   -- provenance the honest-labeling disclaimer can cite (§7)

-- Idempotency: at most one listing per source_ref. Partial so hand-entered
-- listings (source_ref null) are unaffected and can coexist freely.
create unique index listings_source_ref_key
  on listings (source_ref)
  where source_ref is not null;

comment on column listings.source_ref is
  'Stable natural key for curated imports; the seed importer upserts on it. NULL for community-submitted listings.';
comment on column listings.source_url is
  'Where an imported listing was sourced from — backs the self-reported/community-sourced disclaimer (§7). NULL for community submissions.';
