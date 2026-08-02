-- =============================================================================
-- 0015_telehealth.sql — telehealth, split along the seam this repo already draws.
--
-- WHY THIS IS TWO THINGS, NOT ONE FLAG. "Offers telehealth: yes" is exactly the
-- confident, useless yes the ask-ahead page exists to fight. Telling a Deaf
-- patient telehealth is available, when the platform cannot caption and will not
-- let an interpreter join, is worse than telling them nothing: they book, they
-- attend, and the appointment is unusable. Same for a blind patient handed a
-- video platform their screen reader can't drive.
--
-- So availability and usability are stored differently, because they ARE
-- different (migration 0014 established the test):
--
--   1. AVAILABILITY -> a coverage flag (`provider_profiles.offers_telehealth`).
--      Provider-attested, dated, decays fast, NOT community-validated. It shares
--      the existing coverage_source / coverage_as_of / coverage_note, because it
--      is the same kind of fact from the same authority (the practice) and
--      splitting the provenance would let the two drift.
--
--   2. USABILITY -> three §4 attributes, community-validated like any other.
--      Unlike Medicaid ("they took MY plan" says nothing about yours), these
--      GENERALIZE: if the platform drove a screen reader for one blind patient,
--      it will for the next. That is precisely the property that makes something
--      an attribute rather than a coverage flag, so they get the full consensus
--      treatment — >= 3 independent first-person reports, lived-experience
--      weighting, dissent freezes.
--
-- VALENCE. Telehealth is the one coverage flag where `false` is not a blocker —
-- it is "in person only", an absent alternative rather than a closed door. The
-- copy in src/lib/coverage.ts says exactly that and does not dress it up as bad
-- news. It is ordered LAST in the coverage list for the same reason: the three
-- gates decide whether you can be seen at all; this decides whether you have to
-- travel.
--
-- requires_photo = false ON ALL THREE, and this one is not a judgment call:
-- the only "photo" of a telehealth appointment is a screenshot of a medical
-- consultation. Asking for that would invite contributors to upload other
-- people's faces, names, and health information into a public evidence store
-- (§6). No photo evidence is worth that.
--
-- Question wording is present-tense-of-a-past-appointment ("On your telehealth
-- appointment…") rather than the physical "On your visit…", because a visit
-- that never happened is the entire point.
-- =============================================================================

-- 1. Availability — joins the coverage record (0014). Three-valued, same rules:
--    true = offered, false = in person only (a real answer), NULL = unknown ->
--    the UI publishes nothing.
alter table provider_profiles
  add column offers_telehealth boolean;

comment on column provider_profiles.offers_telehealth is
  'Three-valued: true = telehealth offered, false = in person only (a real answer), NULL = unknown, publish nothing. Shares coverage_source / coverage_as_of with the other coverage flags — same authority, same decay.';

-- 2. Usability — real §4 attributes. Idempotent, matching migration 0013.
insert into attribute_definitions
  (key, label, category, applies_to_kind, question_text, requires_photo, reverify_interval_days, relevant_identity_tag)
values
  ('telehealth_platform_accessible', 'Telehealth platform worked with my screen reader',
   'facility_objective', 'provider',
   'On your telehealth appointment, could you use the video platform with your screen reader or by keyboard alone?',
   false, 365, 'blind_low_vision'),

  ('telehealth_captions_or_interpreter', 'Telehealth captions or interpreter worked',
   'facility_objective', 'provider',
   'On your telehealth appointment, were captions available, or could an ASL interpreter join the call?',
   false, 365, 'deaf_hoh'),

  -- relevant_identity_tag = null: an audio-only option helps people on poor
  -- connections, people without a smartphone, people who cannot manage video,
  -- and people for whom being on camera is itself the barrier. No single coarse
  -- tag names that group, so privilege nobody (as with seating_available).
  ('telehealth_audio_only', 'Audio-only appointment allowed',
   'facility_objective', 'provider',
   'On your telehealth appointment, could you take it by phone or audio only, without video?',
   false, 365, null)
on conflict (key) do nothing;
