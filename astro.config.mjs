// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';

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
  // Prefer accessible defaults; keep the build boring and legible.
  build: {
    inlineStylesheets: 'auto',
  },
});
