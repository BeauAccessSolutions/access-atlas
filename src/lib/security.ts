// Single source of truth for the Content-Security-Policy and security headers.
//
// WHY THIS EXISTS (BAS platform invariant #2 — "each app owns its own CSP",
// docs/platform-membership.md; and §2/§6/§14 here): the browsing surface ships
// ZERO JavaScript, so the honest, strongest policy is `script-src 'none'`. That
// is not just hardening — it makes the zero-JS non-negotiable *self-enforcing*:
// if a future change hydrates a React island onto a browsing page, the CSP will
// break it visibly instead of letting a11y/low-bandwidth budget regress silently
// (§5). Keep it that way; if a contributor flow ever legitimately needs script,
// scope it to that route, don't loosen this global default.
//
// The SAME policy string is applied two ways so coverage is host-independent
// (hosting is still an open decision, §13):
//   * as a <meta http-equiv> in Base.astro  → travels inside every page's HTML,
//     so it protects PRERENDERED static pages no matter who serves them;
//   * as a real HTTP header via src/middleware.ts → covers on-demand (SSR)
//     routes and carries the directives <meta> can't (frame-ancestors).
// Browsers ignore `frame-ancestors` in a <meta> CSP and honor it in the header,
// so one string is correct in both places — no divergence to maintain.

// img-src allows https: because evidence photos are served from Supabase Storage
// (a different host, env-dependent — so we can't hard-pin it). data: covers any
// inlined placeholder. style 'unsafe-inline' is required because Astro inlines
// small stylesheets (astro.config.mjs `inlineStylesheets: 'auto'`); it permits
// inline STYLE only, never script.
// LOCAL DEV ONLY: `https:` doesn't cover a local Supabase (http://127.0.0.1),
// so evidence photos would be CSP-blocked in dev. When the configured storage
// origin is non-https we allow exactly that origin. In production Supabase is
// https and this adds nothing — the shipped policy is unchanged.
const devStorageOrigin = (() => {
  const url = process.env.PUBLIC_SUPABASE_URL; // runtime read (see supabase.ts)
  if (!url || url.startsWith('https://')) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
})();

// SCOPED SCRIPT CARVE-OUT (the ONLY routes that ship JavaScript).
//
// Two, and only two, kinds of route carry one self-hosted progressive-enhancement
// script; everywhere else the surface stays strictly zero-JS (script-src 'none'):
//   * the list index pages (/places, /providers) -> /nearby.js, the on-device
//     "sort by distance" feature (docs/adr-0001-nearby-geolocation.md).
//   * the visit-report forms (/contribute/confirm/<claimId> and
//     /contribute/report/<listingId>/<attributeKey>) -> /confirm-camera.js, the
//     native camera capture that no-ops on web and only acts inside the Capacitor
//     iOS app (App Review 4.2; docs/adr-0002-native-camera-capture.md). The
//     report HUB (/contribute/report/<listingId>/) falls under the same prefix
//     but deliberately ships no <script> — asserted in tests/a11y/pages.spec.ts.
// Both are the deliberate, minimal departure from the §5 zero-JS default, to be
// raised as BAS ADRs (§15). Keep this list as SMALL as possible — a new script
// route is a real a11y/perf/privacy decision, not a convenience.
//
// Note default-src stays 'none', so even on these routes the script can make NO
// network requests (no connect-src) — nearby.js can't exfiltrate the visitor's
// location, and confirm-camera.js talks to native over the Capacitor bridge, not
// the network. Nothing leaves the device by network (§6).
const SCRIPT_ENHANCED_ROUTES = new Set(['/places', '/providers']);

// Dynamic routes (a variable id segment) that ship a self-hosted enhancement —
// matched by prefix since the exact path isn't enumerable.
const SCRIPT_ENHANCED_PREFIXES = ['/contribute/confirm/', '/contribute/report/'];

function normalizePath(pathname: string): string {
  const p = (pathname.split('?')[0] || '').replace(/\/+$/, '');
  return p === '' ? '/' : p;
}

/** True only for the routes that ship a self-hosted enhancement script. */
export function routeAllowsScript(pathname: string): boolean {
  const p = normalizePath(pathname);
  if (SCRIPT_ENHANCED_ROUTES.has(p)) return true;
  // Prefix match on the normalized path, e.g. /contribute/confirm/<claimId>.
  return SCRIPT_ENHANCED_PREFIXES.some((pre) => `${p}/`.startsWith(pre));
}

// The CSP for a given route. script-src is 'self' ONLY on the enhanced routes,
// 'none' everywhere else. Everything else is identical to the zero-JS baseline.
export function contentSecurityPolicy(pathname = ''): string {
  const scriptSrc = routeAllowsScript(pathname) ? "script-src 'self'" : "script-src 'none'";
  return [
    "default-src 'none'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' https: data:${devStorageOrigin ? ` ${devStorageOrigin}` : ''}`,
    "font-src 'self'",
    "form-action 'self'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

// Real HTTP headers for on-demand responses (middleware). Privacy-first (§6):
// no-referrer so we never leak the page a user came from. Geolocation is granted
// (self) ONLY on the enhanced routes so navigator.geolocation works there; it
// stays disabled (`geolocation=()`) on every other route.
export function securityHeaders(pathname = ''): Record<string, string> {
  const geolocation = routeAllowsScript(pathname) ? 'geolocation=(self)' : 'geolocation=()';
  return {
    'Content-Security-Policy': contentSecurityPolicy(pathname),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': `${geolocation}, camera=(), microphone=(), interest-cohort=()`,
  };
}

// Zero-JS defaults for any caller that doesn't know the route. Base.astro and
// the middleware pass the real pathname so the carve-out applies per route.
export const CONTENT_SECURITY_POLICY = contentSecurityPolicy();
export const SECURITY_HEADERS: Record<string, string> = securityHeaders();
