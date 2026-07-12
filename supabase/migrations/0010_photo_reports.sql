-- =============================================================================
-- 0010_photo_reports.sql — a user-facing "report this photo" QUEUE (§7 "moderate
-- for fake listings, brigading, and stale data"; §13 deferred follow-up).
--
-- This is the INBOUND signal a visitor raises ("this evidence photo is off-topic
-- / not this place / abusive"). It is NOT a moderation action — an operator later
-- triages the queue and may act via the ops CLIs (moderate:photo /
-- moderate:takedown), which write the separate, append-only moderation_audit
-- (0008). Reports are the to-do list; the audit is what was done.
--
-- GATED, not always-on: the app only renders the report control and only accepts
-- reports when public contributions are open (contributionsOpen() in
-- contributor.ts). A report queue with no contributing public is premature (§13),
-- so today — with contributions closed — nothing writes here.
--
-- PRIVACY (§6 data minimization) — REPORTER-ANONYMOUS:
--   * NO reporter identity of any kind (no cookie id, no ip, no contributor id).
--     A report is a flag on CONTENT, not a record of a person. Browsing is
--     account-free (§2/§6) and stays that way even when reporting.
--   * Stores only what is ALREADY public: the reported photo's claim_id and its
--     public photo_url (the evidence bucket is public-read, 0002), plus a
--     coarse reason CODE from a fixed allow-list — never free text, so a reporter
--     can't inadvertently type personal data into our database.
--   * claim_id / photo_url are plain columns (no FK): a report is a transient
--     triage item that may reference a photo an operator then redacts.
--
-- Ops-only, like moderation_audit (0008) and contributor_sessions (0006): RLS
-- denies public reads; only the service role reads/writes. Unlike the audit table
-- this is NOT append-only — a report has a lifecycle (open -> reviewed), so the
-- service role may update status during triage.
--
-- Additive + orthogonal to the consensus formula — does NOT touch
-- attribute_claims, confirmations, or attribute_claim_status (§4/§13 lockstep
-- unaffected).
-- =============================================================================

-- Coarse reason codes only (no free text — §6). 'other' is the catch-all.
create type photo_report_reason as enum (
  'off_topic',       -- the photo doesn't show the accessibility feature it claims to
  'not_this_place',  -- the photo is of a different place/provider
  'abusive',         -- abusive / harassing / inappropriate content
  'privacy',         -- the photo exposes a person or private information
  'other'
);

create type photo_report_status as enum ('open', 'reviewed');

create table photo_reports (
  id          uuid primary key default gen_random_uuid(),
  claim_id    uuid not null,          -- the reported photo's claim (plain uuid; already public)
  photo_url   text not null,          -- the specific reported photo (already public by URL)
  reason      photo_report_reason not null,
  status      photo_report_status not null default 'open',
  created_at  timestamptz not null default now()
);

create index photo_reports_status_idx on photo_reports (status);
create index photo_reports_claim_idx on photo_reports (claim_id);

comment on table photo_reports is
  'User-submitted "report this photo" queue for ops triage (§7). Reporter-anonymous: stores only already-public content ids + a coarse reason code, never a reporter identity (§6). Gated on contributions being open.';

alter table photo_reports enable row level security;

create policy "no public read: photo_reports"
  on photo_reports for select using (false);

-- Service role reads/writes AND may update status during triage (open -> reviewed).
grant select, insert, update on photo_reports to service_role;
