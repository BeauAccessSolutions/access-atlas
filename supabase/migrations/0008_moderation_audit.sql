-- =============================================================================
-- 0008_moderation_audit.sql — record moderation actions IN THE DATABASE, not
-- just in an operator's terminal scrollback (§7 "moderate for fake listings,
-- brigading, and stale data" — accountability; §13 deferred follow-up).
--
-- The first-cut photo redaction (src/lib/moderation.ts, #7) required a reason
-- but only *logged* it. This gives moderation a durable, tamper-resistant trail:
-- who did what, when, and why.
--
-- PRIVACY (§6 data minimization) — WHAT THIS TABLE DELIBERATELY DOES NOT STORE:
--   * NO contributor_id. The audit is about the CONTENT that was moderated
--     (which photo, which claim), never about WHOM. A confirmation_id is an
--     opaque uuid that stops resolving to a person once the confirmation is
--     gone, so the trail can outlive a contributor's right-to-deletion (§6
--     export/delete) without holding their personal data hostage.
--   * The content ids are plain uuids, NOT foreign keys. An audit row must
--     SURVIVE the deletion of the very row it describes — a confirmation-level
--     takedown deletes the confirmation, and an FK cascade would erase the
--     evidence that the takedown happened. That is the whole point of an audit.
--
-- Ops-only, exactly like contributor_sessions (0006): RLS denies public reads;
-- only the trusted service role can write. And it is APPEND-ONLY — service_role
-- gets INSERT + SELECT but NOT update/delete, so a recorded action can't later
-- be quietly rewritten or erased.
--
-- Additive + orthogonal to the consensus formula — does NOT touch
-- attribute_claims, confirmations, or attribute_claim_status (§4/§13 lockstep
-- unaffected).
-- =============================================================================

-- The kinds of moderation action we record. 'confirmation_takedown' is included
-- now (it lands with the takedown flow) so adding it later isn't a second enum
-- migration; nothing writes it until that code exists.
create type moderation_action as enum (
  'photo_redaction',        -- scrub one evidence photo, keep the visit report (§4 consensus unchanged)
  'confirmation_takedown'   -- remove a fraudulent confirmation (DOES change §4 consensus)
);

create table moderation_audit (
  id              uuid primary key default gen_random_uuid(),
  action          moderation_action not null,
  -- Opaque content references (see header: plain uuids, no FKs). Any may be null
  -- depending on the action / what was known at the time.
  confirmation_id uuid,
  claim_id        uuid,
  listing_id      uuid,
  reason          text not null,     -- mandatory: moderation must be accountable
  actor           text not null,     -- who acted (e.g. 'ops-cli:<operator>'); not a contributor id
  -- Extra structured context: removed-object count, the redacted URL, the
  -- claim's state before/after a takedown, affected claim ids, etc. Free-form so
  -- new action types don't need a migration.
  details         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index moderation_audit_confirmation_idx on moderation_audit (confirmation_id);
create index moderation_audit_claim_idx on moderation_audit (claim_id);
create index moderation_audit_created_idx on moderation_audit (created_at);

comment on table moderation_audit is
  'Durable, append-only trail of moderation actions (§7 accountability). Ops-only; stores moderated CONTENT ids and a reason, never a contributor id (§6).';
comment on column moderation_audit.actor is
  'Who performed the action (operator label), NOT a contributor id — this is about the moderator, not the moderated.';

-- Ops-only + append-only. Mirrors the 0006 private-table pattern (enable RLS,
-- deny public select), but grants the service role INSERT + SELECT only — no
-- update/delete, so the trail is tamper-resistant.
alter table moderation_audit enable row level security;

create policy "no public read: moderation_audit"
  on moderation_audit for select using (false);

grant select, insert on moderation_audit to service_role;
