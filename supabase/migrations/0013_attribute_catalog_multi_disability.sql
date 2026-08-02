-- =============================================================================
-- 0013_attribute_catalog_multi_disability.sql
--
-- Close a live inequity in the §4 weighting model.
--
-- THE PROBLEM this fixes: src/lib/identity-tags.ts offers FIVE coarse reviewer
-- identity tags (wheelchair_user, blind_low_vision, deaf_hoh, cognitive_access,
-- neurodivergent), but the shipped attribute catalog weighted only ONE of them.
-- Six of the seven attributes carried relevant_identity_tag = 'wheelchair_user'
-- and the seventh carried null. So a Deaf, blind, cognitively-disabled or
-- neurodivergent contributor could tag themselves on a visit report and then
-- find NOT ONE attribute in the catalog their tag actually weights — they were
-- structurally second-class in the consensus math (§4 "lived experience is
-- weighted"), and §3's "structure the schema to support all disability types"
-- was true of the schema but not of the data in it.
--
-- This migration adds attributes the other four tags can speak to. It is DATA
-- ONLY — no schema change, no change to the consensus formula in the
-- attribute_claim_status view. Existing claims and states are untouched.
--
-- IT ALSO MOVES THE CATALOG TO ONE HOME. The catalog is reference data, not
-- demo data, but it used to live only in:
--   * supabase/seed.sql          — local only; `db reset` wipes and re-seeds
--   * supabase/provision-cloud.sql — a ONE-TIME cloud bootstrap, already frozen
--                                    at migrations 0001-0007
-- Neither runs against a live production database, so a catalog change had NO
-- path to prod. Migrations do have one (scripts/migrate-deploy.sh runs
-- `supabase db push` as a PRE_DEPLOY job), so from here the catalog lives in the
-- migration chain and seed.sql carries only demo listings/claims.
--
-- Hence this re-declares the original seven rows alongside the eight new ones:
-- an existing database already has them (from seed.sql or provision-cloud.sql)
-- and skips them; a fresh one gets the whole catalog from this file.
--
-- Idempotent (`on conflict (key) do nothing`) on purpose — a fresh cloud project
-- bootstraps from provision-cloud.sql and then has this applied on top, so both
-- orders must converge on the same catalog.
--
-- Wording caveat (§2 "nothing about us without us"): these question texts are a
-- starting point written from the access literature, NOT from community review.
-- They should be tuned with paid disabled co-designers per tag (§5) before the
-- attributes are promoted in recruitment. The keys are the stable part; the
-- question text is a data change.
--
-- Single-tag limitation, deliberately NOT worked around here:
-- relevant_identity_tag is one text column, so an attribute weights exactly one
-- tag. 'service_animal_welcomed' is the clearest casualty — service animals
-- serve many disabilities, but it can only privilege blind_low_vision. Widening
-- the column to an array would change the weighted_agree_count and the
-- community_verified branch of attribute_claim_status, i.e. the safety-critical
-- §4 formula. That is its own decision, not a side effect of adding rows.
-- =============================================================================

insert into attribute_definitions
  (key, label, category, applies_to_kind, question_text, requires_photo, reverify_interval_days, relevant_identity_tag)
values
  -- ---- The original seven (moved here from supabase/seed.sql) -------------
  -- Unchanged wording. Every row weights `wheelchair_user` or nobody — which is
  -- exactly the imbalance the rows further down correct.
  ('entrance_step_free', 'Step-free entrance',
   'facility_objective', null,
   'On your visit, could you enter with zero steps (level or ramped)?',
   true, 365, 'wheelchair_user'),

  ('accessible_restroom', 'Accessible restroom present',
   'facility_objective', null,
   'On your visit, was there a wheelchair-accessible restroom you could use?',
   true, 365, 'wheelchair_user'),

  -- Both kinds (§8b lists provider parking as objective too — Gap B).
  ('accessible_parking', 'Accessible parking',
   'facility_objective', null,
   'On your visit, was there designated accessible parking that was usable?',
   true, 365, 'wheelchair_user'),

  ('height_adjustable_exam_table', 'Height-adjustable exam table',
   'facility_objective', 'provider',
   'On your visit, did the provider have a height-adjustable / low-transfer exam table?',
   true, 365, 'wheelchair_user'),

  -- Core ADA MDE attribute (§8). No public registry -> a first-person /
  -- recruitment target rather than a seedable fact (Gap C).
  ('accessible_scale', 'Wheelchair-accessible scale',
   'facility_objective', 'provider',
   'On your visit, was there a weight scale you could use as a wheelchair user (roll-on / seated)?',
   true, 365, 'wheelchair_user'),

  ('communicated_directly', 'Communicated directly with me',
   'provider_behavior', 'provider',
   'On your visit, did staff speak directly to you (not only to a companion)?',
   false, 365, null),

  ('staff_knew_equipment', 'Staff knew how to use accessible equipment',
   'provider_behavior', 'provider',
   'On your visit, did staff know how to use their accessible equipment?',
   false, 365, 'wheelchair_user'),

  -- ---- Deaf / hard of hearing --------------------------------------------
  -- Interpreter provision is an ADA obligation providers routinely dodge, and
  -- it is the single fact that decides whether an appointment is usable at all.
  -- No photo: the evidence is what happened, not what the room looks like.
  ('interpreter_on_request', 'ASL interpreter arranged on request',
   'provider_behavior', 'provider',
   'On your visit, did the provider arrange an ASL interpreter when you asked for one?',
   false, 365, 'deaf_hoh'),

  ('staff_communicate_in_writing', 'Staff will communicate in writing',
   'provider_behavior', null,
   'On your visit, were staff willing to communicate in writing (notes, or typing on a phone or tablet)?',
   false, 365, 'deaf_hoh'),

  -- Photographable: a captioned screen is visible evidence (§4, §8b).
  ('captions_on_screens', 'Captions turned on for video screens',
   'facility_objective', null,
   'On your visit, were the video screens showing captions?',
   true, 365, 'deaf_hoh'),

  -- ---- Blind / low vision -------------------------------------------------
  -- Service-animal refusal is common, illegal, and humiliating. Highest-signal
  -- binary in this batch. See the single-tag caveat in the header.
  ('service_animal_welcomed', 'Service animal welcomed',
   'provider_behavior', null,
   'On your visit, was your service animal welcomed without being questioned or refused entry?',
   false, 365, 'blind_low_vision'),

  ('staff_read_aloud', 'Staff read printed information aloud',
   'provider_behavior', null,
   'On your visit, did staff read the menu, forms, or signage aloud when you asked?',
   false, 365, 'blind_low_vision'),

  -- ---- Neurodivergent / sensory -------------------------------------------
  ('quiet_waiting_space', 'Quieter space to wait',
   'facility_objective', null,
   'On your visit, was there a quieter area, away from noise and crowds, where you could wait?',
   true, 365, 'neurodivergent'),

  -- ---- Cognitive / learning access ----------------------------------------
  ('plain_language_help', 'Staff explained things in plain language',
   'provider_behavior', null,
   'On your visit, did staff explain things in plain language and help you with forms when you asked?',
   false, 365, 'cognitive_access'),

  -- ---- No privileged identity (relevant_identity_tag = null) --------------
  -- Seating decides how LONG a disabled person can stay, and it blocks people
  -- with chronic illness, fatigue and ambulatory disabilities — constituencies
  -- the coarse tag list does not name. Honest answer: privilege nobody, require
  -- the plain >= 3 agreeing confirmations (same semantics as
  -- 'communicated_directly').
  ('seating_available', 'Seating available while waiting',
   'facility_objective', null,
   'On your visit, was there somewhere to sit while you waited?',
   true, 365, null)
on conflict (key) do nothing;

-- No `notify pgrst, 'reload schema'` here on purpose: this migration inserts
-- ROWS, it does not change the schema, so PostgREST's cached schema is still
-- correct and the new attributes are readable immediately (CLAUDE.md §14b is
-- about column/table changes).
