-- =============================================================================
-- 0018_multi_tag_attributes.sql — an attribute may weight MORE THAN ONE access
-- experience.
--
-- ⚠️  THIS TOUCHES THE §4 CONSENSUS FORMULA. Read the split below before
--     changing anything here.
--
-- THE GAP (§13, flagged since migration 0013). `relevant_identity_tag` is ONE
-- text column, so an attribute weights exactly one identity tag. The clearest
-- casualty is `service_animal_welcomed`: guide dogs, hearing dogs and mobility
-- assistance dogs are all service animals, and their handlers are ALL
-- first-person authorities on whether the animal was welcomed — but only
-- blind_low_vision counted. A Deaf handler's report of being refused with a
-- hearing dog did not weight the fact it was most qualified to speak to.
--
-- THIS MIGRATION IS DELIBERATELY IN TWO PARTS, AND ONLY THE SECOND CHANGES
-- BEHAVIOUR:
--
--   PART 1 — STRUCTURAL, BEHAVIOUR-PRESERVING.
--     scalar -> array, and the formula's `tag = any(reviewer_tags)` becomes the
--     array overlap `tags && reviewer_tags`. For a ONE-ELEMENT array these are
--     exactly equivalent, so converting every existing attribute to a
--     single-element array leaves every claim's state and weighted count
--     bit-for-bit unchanged. That equivalence is the safety property that makes
--     this refactor reviewable: the structure moves, the math does not.
--
--   PART 2 — DATA, DELIBERATE, ONE ATTRIBUTE.
--     Widening a tag set LOOSENS that attribute's verification bar: more people
--     count as lived-experience authorities, so `community_verified` becomes
--     reachable by more combinations of reporters. That is only correct where
--     the added groups genuinely have standing, so exactly one attribute is
--     widened here and it is argued below. Everything else keeps its single tag.
--
-- WHY EMPTY ARRAY RATHER THAN NULL for "no privileged identity": `&&` against
-- NULL is NULL, not false, which would silently break the count. `not null
-- default '{}'` removes the NULL-vs-empty ambiguity entirely, and
-- `cardinality(...) = 0` reads as exactly what it means.
--
-- The TS mirror in src/lib/seed.ts encodes this same formula and MUST be changed
-- with it (§4/§13 lockstep) — it is, in this branch.
-- =============================================================================

-- ---- PART 1: structural -----------------------------------------------------

-- The view is dropped FIRST: it selects relevant_identity_tag, so Postgres
-- refuses to drop that column while the view depends on it.
--
-- ⚠️  DROPPING A VIEW DROPS ITS GRANTS. 0001 granted select to anon +
--     authenticated; 0009 granted it to service_role (without which the ops
--     takedown path fails). All three are re-granted after the new view — do
--     not remove them.
drop view attribute_claim_status;

alter table attribute_definitions
  add column relevant_identity_tags text[] not null default '{}';

-- Behaviour-preserving backfill: each attribute's single tag becomes a
-- one-element array; a NULL tag becomes the empty array.
update attribute_definitions
   set relevant_identity_tags =
         case when relevant_identity_tag is null then '{}'::text[]
              else array[relevant_identity_tag]
         end;

alter table attribute_definitions drop column relevant_identity_tag;

comment on column attribute_definitions.relevant_identity_tags is
  'Whose lived experience is weighted for THIS attribute (§4). Empty = no identity is privileged. An attribute may name SEVERAL — a service animal handler may be blind, Deaf, or a wheelchair user, and each is a first-person authority. Never a permission to report: anyone may report anything, the tags only weight (see src/lib/attribute-groups.ts).';

-- Recreated with the array column. (It was dropped above, before the column
-- change, because it depended on the old scalar.)
create view attribute_claim_status as
select
  c.id                                                            as claim_id,
  c.listing_id,
  c.attribute_def_id,
  d.key                                                           as attribute_key,
  d.label,
  d.category,
  d.relevant_identity_tags,
  d.reverify_interval_days,
  c.sourced,
  c.sourced_note,
  count(f.*) filter (where f.agrees)                              as agree_count,
  count(f.*) filter (where not f.agrees)                          as dissent_count,
  -- `&&` is array overlap: does this reporter carry ANY of the tags this
  -- attribute weights? Identical to the old `= any(...)` when the attribute
  -- names exactly one tag.
  count(f.*) filter (
    where f.agrees
      and cardinality(d.relevant_identity_tags) > 0
      and d.relevant_identity_tags && f.reviewer_identity_tags
  )                                                               as weighted_agree_count,
  max(f.created_at) filter (where f.agrees)                       as last_confirmed_at,
  case
    when max(f.created_at) filter (where f.agrees) is null then null
    else max(f.created_at) filter (where f.agrees)
         < now() - make_interval(days => d.reverify_interval_days)
  end                                                             as is_stale,
  case
    -- Dissent freezes first — safety over everything (§4). Unchanged.
    when count(f.*) filter (where not f.agrees) > 0 then 'disputed'::attribute_state
    when c.sourced then 'sourced'::attribute_state
    when count(f.*) filter (where f.agrees) >= 3
         and (
           -- No privileged identity: the plain >= 3 bar, as before.
           cardinality(d.relevant_identity_tags) = 0
           or count(f.*) filter (
                where f.agrees
                  and d.relevant_identity_tags && f.reviewer_identity_tags
              ) >= 1
         )
      then 'community_verified'::attribute_state
    when count(f.*) filter (where f.agrees) >= 1 then 'community_confirmations'::attribute_state
    else 'self_reported'::attribute_state
  end                                                             as state
from attribute_claims c
join attribute_definitions d on d.id = c.attribute_def_id
left join confirmations f on f.claim_id = c.id
group by c.id, d.id;

-- Re-grant everything the dropped view had (0001 + 0009).
grant select on attribute_claim_status to anon, authenticated;
grant select on attribute_claim_status to service_role;

-- ---- PART 2: the one deliberate widening ------------------------------------
--
-- service_animal_welcomed: a service animal may be a guide dog (blind or low
-- vision), a hearing dog (Deaf or hard of hearing), or a mobility assistance dog
-- (wheelchair or mobility device user). Each handler has directly comparable
-- first-person standing on the only question this attribute asks — was the
-- animal welcomed, or were you questioned and refused.
--
-- NOT added: cognitive_access / neurodivergent. Psychiatric service dogs are
-- real and their handlers are equally authoritative, but neither coarse tag
-- MEANS "psychiatric disability", and stretching one to stand in would mislabel
-- a group rather than include it — the same reasoning that left
-- seating_available and telehealth_audio_only weighting nobody. Those handlers
-- can still report; their report simply isn't weighted, which is the honest
-- position until the tag vocabulary is reviewed with the community (§2, §5).
update attribute_definitions
   set relevant_identity_tags = array['blind_low_vision', 'deaf_hoh', 'wheelchair_user']
 where key = 'service_animal_welcomed';
