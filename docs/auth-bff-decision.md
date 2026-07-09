# Decision: server-side BFF for Keycloak, not a React-island PKCE client

Status: **accepted (2026-07-08)** for Access Atlas · to be promoted to a BAS ADR.
Context: `docs/platform-membership.md`, `CLAUDE.md` §5/§6/§15, and the platform
`PLATFORM.md` (standalone Keycloak, public PKCE client, layered sessions).

## The divergence

`platform-membership.md` §15 describes the platform's default integration as
"the **`packages/auth` PKCE client inside React islands** (contributor flows)" —
i.e. the PKCE dance runs **client-side** and the app then exchanges the token for
a session.

Access Atlas instead runs a **server-side BFF** (Backend-For-Frontend): the
Authorization-Code-+-PKCE flow happens entirely in on-demand routes
(`src/pages/api/auth/*`), and the browser only ever holds an **httpOnly** session
cookie.

## Why

- **Zero-JS is existential here (§5).** The browsing surface ships no script
  (`script-src 'none'`). A client-side PKCE island would put JavaScript — and an
  OIDC token — into the contributor flow. The BFF keeps even the contribute pages
  script-free: sign-in is a plain link, sign-out a plain form POST.
- **Tokens never reach the browser (§6, invariant #1).** The OIDC token is
  validated against Keycloak's JWKS server-side and immediately exchanged for our
  own revocable session. It is never stored client-side, so it can't leak via XSS
  (of which there is little surface, given zero-JS) or extensions.
- **Consistency with what's already here.** The app already authenticates the
  provisional contributor with an httpOnly cookie; the BFF session is the same
  shape, just backed by a real IdP.
- **`packages/auth` doesn't exist in this repo** and would have to be vendored to
  use the island path — more surface for less fit.

## What we still honor

The platform contract is unchanged where it matters: public PKCE client,
Keycloak-hosted login (no custom credential form), **validate-token-against-JWKS
then mint our own** session (not RFC 8693), pairwise `sub`, and step-up (ACR)
reserved for later. The only difference is *where* the flow runs (server, not a
client island).

## Consequences

- Access Atlas needs a **public OIDC client** registered with a redirect URI of
  `${app}/api/auth/callback` — see the "Register the Keycloak client" section in
  `docs/platform-membership.md`.
- The shared `packages/auth` client is **not** a dependency for this app.
- If the platform later mandates the island client for cross-app SSO UX, revisit —
  but the more conservative (more private, zero-JS) rule wins per §15 until then.
