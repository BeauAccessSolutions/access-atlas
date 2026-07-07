// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// Astro is chosen (§9) to ship near-zero JS by default: static list/table
// views render as pure HTML, and React islands hydrate ONLY where a
// contributor flow needs interactivity. Do not convert whole pages to
// client-rendered React — that would blow the low-bandwidth / screen-reader
// budget the project treats as existential (§2, §5).
export default defineConfig({
  // Static output by default. Switch a route to on-demand rendering only when
  // it genuinely needs per-request data; keep the browsing surface static.
  output: 'static',
  integrations: [react()],
  // Prefer accessible defaults; keep the build boring and legible.
  build: {
    inlineStylesheets: 'auto',
  },
});
