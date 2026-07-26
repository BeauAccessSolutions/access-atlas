// @ts-check
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import react from '@astrojs/react';
import node from '@astrojs/node';

// Server-only config (Keycloak, the Supabase service-role key, the provisional
// gate) is read from process.env at RUNTIME so secrets never inline into the
// build — Vite only inlines import.meta.env, so a service-role key read that way
// would ship inside the container image. For local dev + build, mirror .env into
// process.env here. This config file does NOT run in the production standalone
// server (it gets real env from its host), so this affects local tooling only.
//
// An EMPTY value in .env never clobbers a real exported one. `.env.example`
// ships `SITE_ORIGINS=` blank and tells you to copy it, so a plain Object.assign
// would let that blank line silently defeat
// `SITE_ORIGINS=host npm run build` — the same inert-config failure this whole
// file exists to prevent, just moved to the developer's machine.
const fileEnv = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '');
for (const [key, value] of Object.entries(fileEnv)) {
  if (value === '' && process.env[key]) continue;
  process.env[key] = value;
}

// Public origin(s) this app is served from, for Astro's CSRF origin check.
//
// WHY THIS IS NEEDED. Astro's built-in `security.checkOrigin` (on by default for
// on-demand routes) rejects a form POST whose browser `Origin` header doesn't
// match the origin Astro computes for itself. Behind a TLS-terminating proxy —
// DO App Platform here — the container receives plain HTTP with the real host in
// `X-Forwarded-Host`/`X-Forwarded-Proto`. But Astro only TRUSTS those forwarded
// headers for hosts named in `security.allowedDomains`; with none configured it
// refuses the forwarded host and falls back to `localhost`, so it computes its
// origin as `https://localhost` while the browser sends `https://<real-host>`.
// Mismatch → "Cross-site POST form submissions are forbidden" on every POST.
// (Local `astro dev` is unaffected: the dev server doesn't run this validation.)
//
// The fix is to name the real host(s) so the forwarded headers are trusted — NOT
// to disable checkOrigin, which is the actual CSRF protection and, with a
// zero-JS surface (no client token scheme possible), the only layer there is.
//
// Patterns are HOSTNAME-ONLY on purpose. Adding a `protocol` field would route
// protocol-validation through a dummy `example.com` origin that never matches a
// real hostname, silently rejecting the forwarded proto and reintroducing the
// bug. Hostname-only trusts http/https via Astro's simple scheme check while
// still pinning the host exactly.
//
// Build-time (this file bakes it into the manifest), comma-separated, accepts
// full origins or bare hosts. Set SITE_ORIGINS at BUILD time on the host, e.g.
//   SITE_ORIGINS=https://accessatlas.org,access-atlas-xxxx.ondigitalocean.app
// Unset → empty → today's behavior preserved (correct for local dev, where host
// IS localhost). A public hostname is not a secret, so baking it does not touch
// the §6 no-secrets-in-the-image rule.
function allowedDomainsFromEnv() {
  const raw = process.env.SITE_ORIGINS ?? '';
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      // Accept "https://host[:port]" or a bare "host".
      const hostname = entry.includes('://') ? new URL(entry).hostname : entry;
      return { hostname };
    });
}

// Astro is chosen (§9) to ship near-zero JS by default: static list/table
// views render as pure HTML, and React islands hydrate ONLY where a
// contributor flow needs interactivity. Do not convert whole pages to
// client-rendered React — that would blow the low-bandwidth / screen-reader
// budget the project treats as existential (§2, §5).
export default defineConfig({
  // Static-capable by default; pages opt into on-demand rendering with
  // `prerender = false`. Most browsing pages do, for two reasons: (1) they show
  // LIVE data (new submissions, fresh confirmations), and (2) they honor the
  // visitor's saved accessibility settings, which Base.astro reads from a cookie
  // per request (src/lib/settings.ts). On-demand here means server-rendered HTML
  // — it does NOT ship any JS; the zero-JS / low-bandwidth budget is unchanged.
  // The Node adapter serves those routes and the form POST endpoints.
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
  security: {
    // Keep the CSRF origin check ON (this is its default; stated to make the
    // intent unmissable). allowedDomains only tells Astro which forwarded hosts
    // to believe behind the proxy — see allowedDomainsFromEnv above.
    checkOrigin: true,
    allowedDomains: allowedDomainsFromEnv(),
  },
  // Prefer accessible defaults; keep the build boring and legible.
  build: {
    inlineStylesheets: 'auto',
  },
});
