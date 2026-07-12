# ADR 0001 — On-device "sort by distance" (a scoped script on the list pages)

Status: **Accepted** (2026-07-12). To be raised as a **BAS ADR** (§15) because it
narrows a platform/browsing non-negotiable.

## Context

The browsing surface is **zero-JavaScript** by design: `script-src 'none'` in the
CSP, enforced as a non-negotiable (§2/§5/§14, `src/lib/security.ts`). It keeps
the a11y and low-bandwidth guarantees self-enforcing — if a page tries to hydrate
JS, the CSP breaks it visibly instead of letting the budget regress silently.

A user asked for a **"current location / sort by distance"** feature on the
`/places` and `/providers` list pages. Device geolocation
(`navigator.geolocation`) is only available to JavaScript, so this genuinely
conflicts with the zero-JS default. Per §2, that conflict is flagged and decided
explicitly rather than worked around silently.

## Decision

Add **one** self-hosted, dependency-free script — `public/nearby.js` — loaded
**only** on the two list index routes, as a **progressive enhancement**.

Guardrails that keep this the *minimal* departure:

1. **Progressive enhancement, not a dependency.** The page is fully usable with
   no JS: name / ZIP / recently-added sort and the ZIP filter are server-rendered
   zero-JS (GET form). The script only *adds* a "sort by distance" control, and
   only when it runs **and** at least one listing has coordinates — so a no-JS
   visitor never sees an affordance that can't work.
2. **The visitor's location never leaves the device (§6).** The script reads
   coordinates via `navigator.geolocation`, computes distances against the
   listing coordinates already in the page (`data-lat`/`data-lng`), and reorders
   the DOM locally. Nothing is sent to the server or placed in a URL. This is the
   one client action the constitution explicitly permits — *"acts for the
   individual user on their device"* (§2) — and it is the opposite of an
   accessibility overlay.
3. **The CSP stays `default-src 'none'` with no `connect-src`.** Even on these
   routes the script physically **cannot** make a network request, so it cannot
   exfiltrate location even if a future edit tried to. `script-src` relaxes to
   `'self'` **only** on `/places` and `/providers` (route-aware in
   `security.ts`); every other route — including the list *detail* pages — stays
   `script-src 'none'`. `Permissions-Policy: geolocation=(self)` is likewise
   scoped to those two routes; it stays `geolocation=()` everywhere else.
4. **No inline script, ever.** The one script is external and self-hosted. Inline
   script stays banned everywhere (an inline-script allowance is what a CSP
   injection would need). The a11y suite asserts exactly this: the two list pages
   ship exactly one external `/nearby.js` and zero inline scripts; every other
   route ships zero `<script>` at all.

## Consequences

- The strict "zero `<script>` on every browsing page" property is now "zero
  inline script everywhere; exactly one self-hosted external script on the two
  list index pages." The a11y test encodes the new contract.
- Listings need coordinates for distance to mean anything. Seed listings carry
  **approximate** Buffalo coordinates (demo only, not surveyed); real listings
  will carry real coordinates when submitted. The map remains a progressive
  enhancement over the list (§5).
- Keep `SCRIPT_ENHANCED_ROUTES` in `security.ts` as small as possible. Adding a
  new script route is a real a11y/perf/privacy decision — extend this ADR, don't
  loosen the default.

## Alternatives considered

- **Type a ZIP/town as the location anchor (fully zero-JS).** Rejected as the
  *primary* mechanism because the user asked for device location; retained in
  spirit as the no-JS fallback (ZIP sort/filter still work without the script).
- **Send coordinates to the server and sort there.** Rejected: it would put a
  precise location in a request the server sees (and risk it landing in a URL),
  violating §6. On-device keeps the location off our infrastructure entirely.
