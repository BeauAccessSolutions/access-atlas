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
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  if (!url || url.startsWith('https://')) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
})();

export const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'none'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' https: data:${devStorageOrigin ? ` ${devStorageOrigin}` : ''}`,
  "font-src 'self'",
  "form-action 'self'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join('; ');

// Applied as real HTTP headers on on-demand responses (middleware). Privacy-first
// (§6): no-referrer so we never leak the page a user came from to any origin.
export const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  // No script means no need for any of these powerful features on browsing pages.
  'Permissions-Policy': 'geolocation=(), camera=(), microphone=(), interest-cohort=()',
};
