# Platform membership — Access Atlas in the Beau Access Solutions platform

Access Atlas is a member app of the **Beau Access Solutions (BAS)** platform. This
file is the local pointer to the platform governance and the fallback copy of the
platform invariants, per BAS ADR-002 §3 (reference governance by URL; inline the
invariants as a local fallback; no committed cross-repo symlinks).

## Governance home (canonical, by URL)

Governance repo: <https://github.com/Beaudoin0zach/Beau-Access-Solutions>

- `PLATFORM.md` — shared architecture (standalone Keycloak identity, layered sessions, shared design system).
- `INVARIANTS.md` — the five platform invariants (mirrored below as a fallback).
- `docs/adr/001` — standalone Keycloak identity decision.
- `docs/adr/002` — umbrella org, repo topology, no committed cross-repo symlinks.
- `CONTRIBUTING.md` — how an app joins the platform; the PHI/sensitive-data contribution boundary.

Never reference those docs by filesystem path or symlink — always by the URLs above.

## Access Atlas's role

**Full identity member** (committed 2026-07-07), scoped to how this app actually works:

- **Browsing stays account-free.** Public discovery of places/providers requires no
  login — this is a hard non-negotiable of this app (see `CLAUDE.md` §2, §6) and the
  platform does not override it.
- **Identity gates *contribution*, not browsing.** When the contributor write flow
  lands (pseudonymous confirmations/submissions, currently deferred — `CLAUDE.md` §6,
  §13), it authenticates through the platform's **Keycloak** IdP rather than a
  hand-rolled auth. This is the mechanism for the "light auth only for contributors;
  pseudonymous" rule already in `CLAUDE.md` §6.
- **Access Atlas is a sensitive tenant.** Access/disability data is health-adjacent
  (`CLAUDE.md` §6). It therefore follows the layered-session rule: exchange the
  identity token for its **own** short-lived, revocable Supabase-backed session and
  require step-up for sensitive actions — never treat the identity token as a
  data-access credential.
- **The browsing surface stays Astro / near-zero-JS.** "Adopts the shared design
  system" means adopting the shared **a11y design tokens** and the `packages/auth`
  PKCE client *inside its React islands* (contributor flows) — NOT rewriting the
  static, zero-`<script>` browsing pages in React Native. The platform `ui` runtime is
  for interactive/mobile surfaces; Access Atlas's list-first browsing must not regress
  to a heavier stack (a11y + low-bandwidth are existential here — `CLAUDE.md` §5).
  **Divergence:** Access Atlas runs a **server-side BFF** for the OIDC flow rather
  than the client-side `packages/auth` island — tokens stay server-side and the
  contribute pages stay zero-JS. Rationale in `docs/auth-bff-decision.md` (to be
  promoted to a BAS ADR).

## Current status (2026-07-07)

The contribution flow exists; the *identity* half is still on paper because the
platform IdP is Phase 0 (not stood up). Current state:

- [x] Governance pointer + invariants fallback (this file).
- [x] Contributor **confirmation flow** built — zero-JS semantic form
  (`src/pages/contribute/confirm/[claimId].astro`) + write endpoint
  (`src/pages/api/confirmations.ts`) with server-side validation, evidence-photo
  handling (EXIF stripped via sharp before storage, §6), and the §4 independence
  rule enforced by the DB.
- [x] Contributor-identity **seam** (`src/lib/contributor.ts`) — provisional
  pseudonymous id today, keyed so Keycloak `sub` drops in later.
- [x] Write **hard-gate** — the endpoint refuses unless
  `ALLOW_PROVISIONAL_CONTRIBUTIONS=true` (local/preview only), so an
  unauthenticated write endpoint cannot ship by accident.
- [x] **CSP / security headers** (invariant #2, "each app owns its own CSP") —
  single policy in `src/lib/security.ts`, applied as a `<meta>` in
  `src/layouts/Base.astro` (covers prerendered static pages, host-independent)
  and as real HTTP headers via `src/middleware.ts` (SSR routes + frame-ancestors).
  `script-src 'none'` makes the zero-JS non-negotiable self-enforcing (§2/§5).
- [x] **CODEOWNERS** (invariant #4) — `.github/CODEOWNERS` guards the write path,
  service-role client, identity seam, security policy, and safety-critical SQL.
  Still needs "Require review from Code Owners" enabled in branch protection.
- [ ] Register an OIDC client for Access Atlas on Keycloak (when the IdP exists) —
  see "Register the Keycloak client" below.
- [x] Replace the provisional cookie seam with the Keycloak-verified `sub` —
  **code-complete, config-gated** (`src/lib/contributor.ts` `resolveContributor`;
  the BFF flow in `src/pages/api/auth/*`). Goes live when the three `KEYCLOAK_*`
  env vars are set; until then, behavior is unchanged.
- [x] Token-exchange → own Supabase data-access session — **done** as
  validate-JWKS-then-mint (`src/lib/auth/{verify,session}.ts`); sessions are
  revocable rows (`contributor_sessions`, migration `0006`). Step-up (ACR) is
  deferred to Phase B, matching the platform roadmap.
- [x] **Decoupled deletion / export** (invariant #3 + §6 CCPA/CPRA) — the
  independently-callable, complete workflow exists: `src/lib/data-rights.ts`
  (`exportContributorData` / `deleteContributorData`, storage-aware, idempotent,
  unit-tested) driven by the `scripts/data-rights.mjs` ops CLI. Keyed by
  contributor id today; the Keycloak `sub` resolves to it later with no change to
  the module.
  - [x] **Self-service front door** — `/account/` (see what we hold + counts),
    `POST /api/account/export` (immediate JSON download), and `/account/delete/`
    → `POST /api/account/delete` (typed-word destructive-action confirmation,
    the a11y-audit Tier 3 pattern). Gated by the contributor seam
    (`getAccountContributor`: verified session, or the provisional stand-in when
    explicitly enabled — resolves only to *yourself*, never creates a
    contributor, never resurrects a deleted one from a stale cookie). Reuses the
    same `data-rights.ts` implementation as the ops CLI; self-service never
    purges submitted listings (ops-only override). §4 consensus side effects
    (a departing dissent un-freezing a claim) are logged for re-review, never
    silent. Phase B attach point: step-up (ACR) goes on the delete endpoint.
- [ ] Adopt shared a11y design tokens where they don't regress the zero-JS browsing surface.

## Register the Keycloak client (when the IdP is stood up)

The app-side integration is drop-in; only these platform-side steps remain. On the
Keycloak realm, create a client for Access Atlas:

- **Client type:** public (no client secret), **Standard flow** (Authorization
  Code) with **PKCE (S256)** required.
- **Valid redirect URI:** `${APP_ORIGIN}/api/auth/callback` (exact).
- **Valid post-logout redirect URI:** `${APP_ORIGIN}/`.
- **Subject type:** **pairwise** (per-app `sub`, no cross-app correlation — §6).
- **Scopes:** `openid` is sufficient (we read `sub`, and `acr` for later step-up).

Then set the three server-only env vars (`.env`, never committed):

```
KEYCLOAK_ISSUER=https://<host>/realms/<realm>
KEYCLOAK_CLIENT_ID=<the client id created above>
KEYCLOAK_REDIRECT_URI=${APP_ORIGIN}/api/auth/callback
```

Setting all three flips `keycloakConfigured()` true: contribution switches from the
provisional cookie to real auth, and unauthenticated writes return `need_signin` —
including the self-service data-rights door (`/account/`), which then requires a
verified session. No code change. Phase B then narrows service-role writes to
RLS-scoped sessions and adds step-up (ACR) on sensitive actions (the delete
endpoint is the marked attach point).

## The five platform invariants (fallback copy — canonical version in governance `INVARIANTS.md`)

1. **Layered sessions.** The identity service proves *who you are* (short-lived OIDC
   token). Sensitive apps **exchange** it for their **own** short-lived, revocable,
   rate-limited data-access session and require **step-up** for sensitive actions. An
   identity token is never itself a data credential.
2. **No platform tracking on sensitive pages.** The shared `ui` is telemetry-free; an
   import-boundary lint makes importing analytics into a sensitive route a build
   failure; each app owns its own CSP. (Access Atlas already ships zero trackers and
   zero JS on browsing pages — it satisfies this trivially today.)
3. **Decoupled deletion / export.** Identity stores identity only, keyed by `sub`. Each
   app owns its data lifecycle; delete/export stay independently callable and complete.
   (Access Atlas owns its Supabase data lifecycle.)
4. **Contribution boundary.** Sensitive backends stay in their own repos — trust
   boundary = repo boundary. Shared `ui`/`auth`/`config` stay open; sensitive paths get
   CODEOWNERS + required review.
5. **i18n ownership.** Shared `ui` components carry zero hardcoded copy; string
   catalogs are per-app owned with per-app human-review gates. The platform never
   injects strings.

These map onto Access Atlas's own non-negotiables (`CLAUDE.md` §2, §5, §6) and never
relax them. If a platform requirement ever conflicts with an Access Atlas
non-negotiable, the more conservative (more accessible, more private) rule wins and the
conflict gets raised as a BAS ADR.
