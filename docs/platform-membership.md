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

## Current status (2026-07-07)

Onboarding is a **commitment on paper**, not yet wired up. Nothing below is
implemented yet; the platform IdP itself is still Phase 0 (not stood up):

- [ ] Register an OIDC client for Access Atlas on Keycloak (when the IdP exists).
- [ ] Build the pseudonymous contributor auth flow via `packages/auth` (PKCE).
- [ ] Token-exchange → own Supabase data-access session for contributor writes.
- [ ] Adopt shared a11y design tokens where they don't regress the zero-JS browsing surface.
- [x] Governance pointer + invariants fallback (this file).

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
