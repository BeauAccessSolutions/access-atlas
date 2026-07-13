import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Every user-facing route gets an automated axe scan against WCAG 2.2 A/AA (§5).
// Add new routes here as they are built. Keep this list in sync with the seed
// so detail pages are covered too.
const ROUTES = [
  '/',
  '/places/',
  '/providers/',
  // filter panel open + result count (zero-JS GET form)
  '/places/?category=arts_culture&county=Erie+County',
  // filtered empty state (an intentionally over-narrow combination)
  '/providers/?q=zzz-no-such-listing&literate=1',
  '/about/privacy/',
  '/about/accessibility/',
  '/about/help/',
  '/settings/',
  // seeded detail pages (ids from supabase/seed.sql + src/lib/seed.ts)
  '/places/11111111-1111-1111-1111-111111111111/',
  '/providers/33333333-3333-3333-3333-333333333333/',
  // contribute routes (on-demand). With no DB attached in CI these render from
  // seed / the gate notice — still must pass axe.
  '/contribute/confirm/c1111111-1111-1111-1111-111111111111/',
  '/contribute/submit/?kind=place',
  '/contribute/submit/?kind=provider',
  // self-service data rights (on-demand; renders the no-DB notice in CI)
  '/account/',
  '/account/delete/',
];

for (const route of ROUTES) {
  test(`no axe violations: ${route}`, async ({ page }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  // Every page title names the page and ends with the site name, so a
  // screen-reader user always knows where they are (§5). Asserted here so the
  // manual AT run sheet (docs/manual-at-testing.md) doesn't have to spend
  // paid tester time on it.
  test(`title ends with site name: ${route}`, async ({ page }) => {
    await page.goto(route);
    await expect(page).toHaveTitle(/— Access Atlas$/);
  });
}

// A minimal structural check that survives refactors: every page must expose a
// single <h1>, a main landmark, and a working skip link (§5). Automated axe
// won't catch a missing skip link, so we assert it directly.
test('home has skip link, one h1, and a main landmark', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('a.skip-link')).toHaveText(/skip to main content/i);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('main#main')).toBeVisible();
});

// The community-validation layer is the moat (§4): a listing with claims must
// expose a prominent entry point into the per-attribute confirm flow. Assert the
// top-level "Report a visit" CTA anchors to the accessibility section, and that
// each claim row carries its own link into /contribute/confirm/{claimId}/.
test('seeded place exposes the report-a-visit CTA + per-attribute confirm links', async ({ page }) => {
  await page.goto('/places/11111111-1111-1111-1111-111111111111/');

  const cta = page.locator('aside.report-cta a.btn');
  await expect(cta).toHaveText(/report a visit/i);
  await expect(cta).toHaveAttribute('href', '#accessibility');
  // The anchor target exists (keyboard/screen-reader users must land somewhere).
  await expect(page.locator('#accessibility')).toBeVisible();

  // Every claim row links into the confirm flow.
  const confirmLinks = page.locator('.attr-list a.report-link');
  expect(await confirmLinks.count()).toBeGreaterThan(0);
  for (const href of await confirmLinks.evaluateAll((els) => els.map((e) => e.getAttribute('href')))) {
    expect(href).toMatch(/^\/contribute\/confirm\/[^/]+\/$/);
  }
});

// The browsing surface stays zero-JS everywhere EXCEPT the two list index pages,
// which ship ONE self-hosted progressive-enhancement script (/nearby.js — the
// on-device "sort by distance" feature; §13, ADR docs/adr-0001-nearby-geolocation.md).
// Everything else — including the list DETAIL pages — must ship no <script> at
// all (low-bandwidth mandate, §5).
for (const route of ['/', '/settings/', '/about/accessibility/', '/about/help/', '/places/11111111-1111-1111-1111-111111111111/', '/account/', '/account/delete/']) {
  test(`ships zero <script>: ${route}`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('script')).toHaveCount(0);
  });
}

// The list index pages ship EXACTLY ONE script: the external, self-hosted
// /nearby.js. No inline script anywhere (that's the part of the zero-JS
// guarantee that stays absolute — an inline script is what a CSP injection would
// need). And the page must be fully populated WITHOUT the script having run
// (server-rendered), which the axe scans above already exercise.
for (const route of ['/places/', '/places/?q=cafe&owned=1', '/providers/']) {
  test(`list page ships only the self-hosted enhancement script: ${route}`, async ({ page }) => {
    await page.goto(route);
    const scripts = page.locator('script');
    await expect(scripts).toHaveCount(1);
    // External (has src), self-hosted, and NOT inline (no text content).
    await expect(scripts.first()).toHaveAttribute('src', '/nearby.js');
    expect((await scripts.first().textContent())?.trim() || '').toBe('');
  });
}
