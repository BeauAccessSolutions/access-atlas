-- =============================================================================
-- 0006_contributor_identity.sql — key contributors by the Keycloak subject and
-- give the app its own revocable data-access session (§15 + BAS invariant #1).
--
-- Two additions, both drop-in for the Keycloak swap (docs/platform-membership.md):
--
-- 1. contributors.sub — the Keycloak PAIRWISE subject id. Pairwise means each app
--    gets a DIFFERENT stable `sub` for the same person, so identities can't be
--    correlated across platform apps (§6). Nullable: provisional/pre-Keycloak
--    contributors have no sub. Unique: one contributor row per subject.
--
-- 2. contributor_sessions — the app's OWN session, minted AFTER validating the
--    OIDC token against Keycloak's JWKS (layered sessions, invariant #1: the
--    identity token is never itself a data credential). The httpOnly cookie holds
--    a random token; we store only its SHA-256 hash here, so a leaked DB read
--    can't be replayed as a session. Revocable (revoked_at) and expiring.
--
-- Additive + orthogonal to the consensus formula — does NOT touch attribute_claims,
-- confirmations, or attribute_claim_status (§4/§13 lockstep unaffected).
-- =============================================================================

alter table contributors
  add column sub text unique;

comment on column contributors.sub is
  'Keycloak PAIRWISE subject id (per-app; never cross-app, §6). Null for provisional/pre-Keycloak contributors (§15, invariant #3).';

-- The app-owned, revocable session. Keyed by a hash of the cookie token so the
-- raw session token is never stored (leaked DB rows can't be replayed).
create table contributor_sessions (
  id             uuid primary key default gen_random_uuid(),
  contributor_id uuid not null references contributors(id) on delete cascade,
  token_hash     text not null unique,   -- sha256(cookie token); raw token never stored
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null,
  revoked_at     timestamptz             -- non-null => revoked (logout / admin)
);

create index contributor_sessions_contributor_idx
  on contributor_sessions (contributor_id);

-- Sessions are private, exactly like contributors: never publicly readable, and
-- written only by the trusted service role (the BFF auth routes). Mirrors the
-- 0001 pattern — enable RLS, deny public select, grant DML to service_role only.
alter table contributor_sessions enable row level security;

create policy "no public read: contributor_sessions"
  on contributor_sessions for select using (false);

grant select, insert, update, delete on contributor_sessions to service_role;
