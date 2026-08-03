-- =============================================================================
-- 0016_coverage_audit.sql — make coverage writes accountable.
--
-- WHY OPS WRITES THESE AND NOT THE PRACTICE (yet). Coverage's authority IS the
-- practice (0014), so the obvious answer is a provider-facing form. It is not
-- buildable today, and shipping it early would be actively dangerous:
--   * There is no authenticated identity to hang it on — the Keycloak BFF is
--     built but config-gated OFF and blocked on the platform IdP standup (§13).
--   * There is no claim-a-listing / practice-verification flow AT ALL. Proving
--     someone is the office manager at a given practice (domain email, mailed
--     code, phone callback) is its own project.
--   * Without that proof, a public write on MONEY facts is a fraud vector: mark
--     a competitor "not accepting new patients" and you have diverted their
--     patients. The other write surfaces in this app are safe to open early
--     because §4 consensus absorbs a bad actor — three independent confirmations,
--     dissent freezes. Coverage has NO consensus layer by design, so a single
--     write publishes immediately. It cannot be opened on the same terms.
-- So: ops writes it, and src/lib/coverage-write.ts is the seam. A verified
-- provider flow later replaces the INPUT without touching storage, presentation,
-- or the fail-safe rules.
--
-- WHY REUSE moderation_audit RATHER THAN A PARALLEL TABLE. Its shape is already
-- exactly right — append-only, ops-only, actor + reason mandatory, free-form
-- jsonb details, content ids as plain uuids with no FKs, and NO contributor_id
-- (§6). Standing up a second append-only audit table would duplicate all of
-- that RLS and grant reasoning for no gain.
--
-- But this DOES widen the table's documented purpose, so say so rather than
-- sneak it in: a coverage update is authoring, not moderation. The table is
-- henceforth "an append-only trail of operator actions on published data", and
-- the comment below is updated to match. `reason` carries how the operator
-- knows — "called the office, spoke to reception" — which is exactly the
-- accountability a published money fact needs.
-- =============================================================================

-- IF NOT EXISTS keeps this idempotent. Only ADDED here, never used in this
-- transaction (Postgres forbids using a new enum value in the transaction that
-- adds it); the first write happens later, from the ops CLI.
alter type moderation_action add value if not exists 'coverage_update';

comment on type moderation_action is
  'Operator actions recorded in moderation_audit. photo_redaction / confirmation_takedown are moderation (removing content); coverage_update is authoring (publishing a dated, sourced provider coverage fact — migration 0016). All are ops-only actions on published data.';

comment on table moderation_audit is
  'Append-only trail of operator actions on published data — moderation removals AND coverage authoring (0016). Ops-only: RLS denies public reads, service_role has INSERT + SELECT but no UPDATE/DELETE. Stores NO contributor_id (§6); content ids are plain uuids with no FKs so a row survives deletion of what it describes.';
