-- =============================================================================
-- seed.sql — minimal, WNY-first demo data (§3).
--
-- Deliberately tiny and Buffalo/Erie-County scoped. Do NOT seed NYC-scale or
-- nationwide data (§3, §14). This exists to exercise the labeling states and
-- the list-first UI, not to look "full". Placeholder listings; not real
-- endorsements of real businesses.
--
-- Loaded automatically by `supabase db reset`. The app's TypeScript seed
-- (src/lib/seed.ts) mirrors these rows so the site renders with no DB attached.
-- =============================================================================

-- Attribute catalog (§8) ------------------------------------------------------
-- NOT HERE ANY MORE. The catalog is reference data, not demo data, so it now
-- lives in the migration chain — supabase/migrations/0013_attribute_catalog_
-- multi_disability.sql — which is the only path that reaches a live production
-- database (scripts/migrate-deploy.sh runs `supabase db push` pre-deploy).
-- seed.sql runs only on a local `db reset`, so a catalog kept here could never
-- ship. src/lib/seed.ts still mirrors the catalog for rendering with no DB
-- attached; tests/unit/attribute-catalog.test.ts holds the two in step.
--
-- The claims below resolve attribute ids by key, so they read whatever the
-- migration installed.

-- Listings — a handful in Erie County (§3). disabled_owned / disabled_led live
-- here now (both kinds, §12); disability_literate stays on provider_profiles.
-- lat/lng are APPROXIMATE Buffalo-neighborhood coordinates for these placeholder
-- listings — enough to demonstrate the on-device "sort by distance" enhancement,
-- NOT surveyed addresses. Real listings will carry real coordinates when
-- submitted. The map stays a progressive enhancement over the list (§5).
insert into listings (id, kind, name, summary, city, region, postal_code, category, disabled_owned, disabled_led, lat, lng, coords_source) values
  ('11111111-1111-1111-1111-111111111111', 'place', 'Elmwood Village Cafe',
   'Neighborhood cafe on Elmwood Ave.', 'Buffalo', 'Erie County', '14222', 'business', false, false, 42.9180, -78.8784, 'approximate'),
  ('22222222-2222-2222-2222-222222222222', 'place', 'Central Library — Downtown',
   'Public library, main branch.', 'Buffalo', 'Erie County', '14203', 'library', false, false, 42.8867, -78.8739, 'approximate'),
  ('33333333-3333-3333-3333-333333333333', 'provider', 'Lakeshore Family Medicine',
   'Primary care practice.', 'Buffalo', 'Erie County', '14201', 'healthcare', false, true, 42.9010, -78.8760, 'approximate'),
  -- Deliberately CLAIMLESS (zero attribute claims): exercises the "no facts
  -- reported yet — be the first" entry into the report flow (§4). Keep it so.
  ('44444444-4444-4444-4444-444444444444', 'place', 'Example Test Place — claimless fixture',
   'Not a real business. A test fixture with no accessibility reports, used to exercise the "be the first to report" flow.',
   'Buffalo', 'Erie County', '14213', 'business', true, false, 42.9160, -78.8950, 'approximate');

-- Coverage (migration 0014) carries a SOURCE and a DATE, because without both
-- the UI publishes nothing. accepts_medicare is deliberately left NULL to
-- exercise the unknown path: it must render nothing at all, not "no".
insert into provider_profiles (
  listing_id, disability_literate,
  accepting_new_patients, accepts_medicaid, accepts_medicare, offers_telehealth,
  coverage_source, coverage_as_of, coverage_note
) values
  ('33333333-3333-3333-3333-333333333333', true,
   true, true, null, true,
   'self_attested', current_date - 30, null);

-- Claims + confirmations, hand-tuned to show every labeling state ------------
-- (§4). Contributors are pseudonymous placeholders.
insert into contributors (id, pseudonym) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'river'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'quill'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'harbor'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'meadow');

-- community_verified: 3 agreeing, one from a wheelchair user (weighted) ------
insert into attribute_claims (id, listing_id, attribute_def_id)
  select 'c1111111-1111-1111-1111-111111111111',
         '11111111-1111-1111-1111-111111111111', id
  from attribute_definitions where key = 'entrance_step_free';
insert into confirmations (claim_id, contributor_id, agrees, reviewer_identity_tags, visited_on) values
  ('c1111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', true, '{wheelchair_user}', '2026-05-01'),
  ('c1111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000002', true, '{}', '2026-05-10'),
  ('c1111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000003', true, '{}', '2026-06-01');

-- community_confirmations (N): 2 agreeing, below the >= 3 bar ----------------
insert into attribute_claims (id, listing_id, attribute_def_id)
  select 'c2222222-2222-2222-2222-222222222222',
         '11111111-1111-1111-1111-111111111111', id
  from attribute_definitions where key = 'accessible_restroom';
insert into confirmations (claim_id, contributor_id, agrees, reviewer_identity_tags, visited_on) values
  ('c2222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000001', true, '{wheelchair_user}', '2026-05-01'),
  ('c2222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000004', true, '{}', '2026-05-20');

-- disputed: a credible dissent freezes an otherwise-confirmed claim ----------
insert into attribute_claims (id, listing_id, attribute_def_id)
  select 'c3333333-3333-3333-3333-333333333333',
         '22222222-2222-2222-2222-222222222222', id
  from attribute_definitions where key = 'entrance_step_free';
insert into confirmations (claim_id, contributor_id, agrees, reviewer_identity_tags, visited_on) values
  ('c3333333-3333-3333-3333-333333333333', 'aaaaaaaa-0000-0000-0000-000000000002', true, '{}', '2026-04-01'),
  ('c3333333-3333-3333-3333-333333333333', 'aaaaaaaa-0000-0000-0000-000000000001', false, '{wheelchair_user}', '2026-06-15');

-- sourced: backed by a partner audit (the only "high confidence" state) ------
insert into attribute_claims (id, listing_id, attribute_def_id, sourced, sourced_note)
  select 'c4444444-4444-4444-4444-444444444444',
         '22222222-2222-2222-2222-222222222222', id, true, 'Erie County facilities ADA audit, 2026'
  from attribute_definitions where key = 'accessible_restroom';

-- self_reported: a fresh claim with zero confirmations yet -------------------
insert into attribute_claims (id, listing_id, attribute_def_id)
  select 'c5555555-5555-5555-5555-555555555555',
         '33333333-3333-3333-3333-333333333333', id
  from attribute_definitions where key = 'height_adjustable_exam_table';
