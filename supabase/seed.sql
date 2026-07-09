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
insert into attribute_definitions (key, label, category, applies_to_kind, question_text, requires_photo, reverify_interval_days, relevant_identity_tag) values
  ('entrance_step_free', 'Step-free entrance', 'facility_objective', null,
   'On your visit, could you enter with zero steps (level or ramped)?', true, 365, 'wheelchair_user'),
  ('accessible_restroom', 'Accessible restroom present', 'facility_objective', null,
   'On your visit, was there a wheelchair-accessible restroom you could use?', true, 365, 'wheelchair_user'),
  -- accessible_parking applies to BOTH kinds (null): §8b lists accessible parking
  -- as an objective PROVIDER facility attribute too, not just for places (Gap B).
  ('accessible_parking', 'Accessible parking', 'facility_objective', null,
   'On your visit, was there designated accessible parking that was usable?', true, 365, 'wheelchair_user'),
  ('height_adjustable_exam_table', 'Height-adjustable exam table', 'facility_objective', 'provider',
   'On your visit, did the provider have a height-adjustable / low-transfer exam table?', true, 365, 'wheelchair_user'),
  -- accessible_scale: core ADA MDE attribute (§8). Zero seed claims exist anywhere
  -- (no public registry) — it is a first-person/recruitment target (Gap C).
  ('accessible_scale', 'Wheelchair-accessible scale', 'facility_objective', 'provider',
   'On your visit, was there a weight scale you could use as a wheelchair user (roll-on / seated)?', true, 365, 'wheelchair_user'),
  ('communicated_directly', 'Communicated directly with me', 'provider_behavior', 'provider',
   'On your visit, did staff speak directly to you (not only to a companion)?', false, 365, null),
  ('staff_knew_equipment', 'Staff knew how to use accessible equipment', 'provider_behavior', 'provider',
   'On your visit, did staff know how to use their accessible equipment?', false, 365, 'wheelchair_user');

-- Listings — a handful in Erie County (§3). disabled_owned / disabled_led live
-- here now (both kinds, §12); disability_literate stays on provider_profiles.
insert into listings (id, kind, name, summary, city, region, postal_code, category, disabled_owned, disabled_led) values
  ('11111111-1111-1111-1111-111111111111', 'place', 'Elmwood Village Cafe',
   'Neighborhood cafe on Elmwood Ave.', 'Buffalo', 'Erie County', '14222', 'business', false, false),
  ('22222222-2222-2222-2222-222222222222', 'place', 'Central Library — Downtown',
   'Public library, main branch.', 'Buffalo', 'Erie County', '14203', 'library', false, false),
  ('33333333-3333-3333-3333-333333333333', 'provider', 'Lakeshore Family Medicine',
   'Primary care practice.', 'Buffalo', 'Erie County', '14201', 'healthcare', false, true);

insert into provider_profiles (listing_id, disability_literate) values
  ('33333333-3333-3333-3333-333333333333', true);

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
