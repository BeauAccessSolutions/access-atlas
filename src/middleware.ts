// Applies the shared security headers (src/lib/security.ts) to every on-demand
// (SSR) response — BAS platform invariant #2 ("each app owns its own CSP").
//
// Middleware runs ONLY for on-demand routes; prerendered static pages don't pass
// through here. Those are covered by the <meta http-equiv> CSP baked into every
// page by Base.astro, so coverage is complete either way. This header path adds
// the directives <meta> can't express (frame-ancestors) and the non-CSP security
// headers, and is authoritative wherever a server actually serves the response.
import { defineMiddleware } from 'astro:middleware';
import { securityHeaders } from './lib/security';

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  // Route-aware: the list index pages relax script-src/geolocation for the
  // /nearby.js enhancement; every other route stays zero-JS (security.ts).
  for (const [name, value] of Object.entries(securityHeaders(context.url.pathname))) {
    // Don't clobber a header a route set deliberately.
    if (!response.headers.has(name)) response.headers.set(name, value);
  }
  return response;
});
