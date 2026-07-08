// Applies the shared security headers (src/lib/security.ts) to every on-demand
// (SSR) response — BAS platform invariant #2 ("each app owns its own CSP").
//
// Middleware runs ONLY for on-demand routes; prerendered static pages don't pass
// through here. Those are covered by the <meta http-equiv> CSP baked into every
// page by Base.astro, so coverage is complete either way. This header path adds
// the directives <meta> can't express (frame-ancestors) and the non-CSP security
// headers, and is authoritative wherever a server actually serves the response.
import { defineMiddleware } from 'astro:middleware';
import { SECURITY_HEADERS } from './lib/security';

export const onRequest = defineMiddleware(async (_context, next) => {
  const response = await next();
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    // Don't clobber a header a route set deliberately.
    if (!response.headers.has(name)) response.headers.set(name, value);
  }
  return response;
});
