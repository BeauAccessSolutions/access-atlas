-- =============================================================================
-- 0005_listing_category.sql — a coarse category for scannability.
--
-- `category` is a small controlled vocabulary (src/lib/categories.ts) used purely
-- to help people scan the directory with an icon + label (healthcare, library,
-- transit, ...). It is NOT part of the validation model (§4) — a category never
-- touches an attribute claim's state. Free `text` (nullable), like attribute
-- keys, so adding a category later is a data change, not a migration. NULL is
-- fine and renders as no category.
-- =============================================================================

alter table listings add column category text;

comment on column listings.category is
  'Coarse scannability category (see src/lib/categories.ts): healthcare, disability_services, business, library, arts_culture, parks_recreation, transit. NULL = uncategorised. Not part of the validation model.';
