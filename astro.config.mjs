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
  // Static output by default: the whole browsing surface prerenders to pure HTML.
  // Only the contributor routes opt into on-demand rendering (`prerender = false`)
  // — they need a per-request server to accept a form POST and write to Postgres.
  // The Node adapter serves those; it does NOT make the browsing pages ship JS.
  output: 'static',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
  // Prefer accessible defaults; keep the build boring and legible.
  build: {
    inlineStylesheets: 'auto',
  },
});
