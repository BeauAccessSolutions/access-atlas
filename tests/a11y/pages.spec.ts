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
  '/about/',
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
  // the claimless seed place (the "be the first to report" CTA mode)
  '/places/44444444-4444-4444-4444-444444444444/',
  // report hub (tracked + unreported sections) and the first-report form
  '/contribute/report/11111111-1111-1111-1111-111111111111/',
  '/contribute/report/11111111-1111-1111-1111-111111111111/accessible_parking/',
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

// WCAG 1.4.10 Reflow: at 320 CSS px wide (equivalent to 400% zoom on a
// 1280px screen) no page may need horizontal scrolling. This is the machine
// half of the low-vision protocol (docs/manual-low-vision-testing.md) — the
// human half (readability under magnification, contrast modes) stays manual.
for (const route of ROUTES) {
  test(`no horizontal overflow at 320px: ${route}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(route);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBe(0);
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

// A CLAIMLESS listing must NOT be a dead end (§4): it renders the same
// prominent CTA, honestly reworded ("be the first"), pointing at the report hub
// — where every unreported fact links into the first-report form.
test('claimless place exposes the be-the-first CTA into the report hub', async ({ page }) => {
  await page.goto('/places/44444444-4444-4444-4444-444444444444/');

  const cta = page.locator('aside.report-cta a.btn');
  await expect(cta).toHaveText(/report an accessibility fact/i);
  await expect(cta).toHaveAttribute(
    'href',
    '/contribute/report/44444444-4444-4444-4444-444444444444/'
  );

  // Follow it: the hub lists only "be the first" links (no claims exist), each
  // into the first-report form for this listing.
  await page.goto('/contribute/report/44444444-4444-4444-4444-444444444444/');
  const firstLinks = page.locator('main a[href^="/contribute/report/44444444-"]');
  expect(await firstLinks.count()).toBeGreaterThan(0);
  for (const href of await firstLinks.evaluateAll((els) => els.map((e) => e.getAttribute('href')))) {
    expect(href).toMatch(/^\/contribute\/report\/44444444-[0-9a-f-]+\/[a-z_]+\/$/);
  }
});

// The browsing surface stays zero-JS everywhere EXCEPT the two list index pages,
// which ship ONE self-hosted progressive-enhancement script (/nearby.js — the
// on-device "sort by distance" feature; §13, ADR docs/adr-0001-nearby-geolocation.md).
// Everything else — including the list DETAIL pages — must ship no <script> at
// all (low-bandwidth mandate, §5).
for (const route of ['/', '/settings/', '/about/', '/about/accessibility/', '/about/help/', '/places/11111111-1111-1111-1111-111111111111/', '/account/', '/account/delete/']) {
  test(`ships zero <script>: ${route}`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('script')).toHaveCount(0);
  });
}

// At most ONE nav item may carry aria-current="page" (§5 — two "you are here"
// markers is worse than none for a screen-reader user). Nav matching is
// PREFIX-based, so this breaks the moment someone adds a nav href that is a
// prefix of another without marking it `exact` in Base.astro. That is precisely
// what "/about/" is: a prefix of /about/help/ and /about/privacy/.
//
// Zero is legitimate and deliberate: a route with no matching nav section
// (/about/accessibility/ reaches the reader from the footer) lights nothing
// rather than guessing. So the invariant under test is "never more than one".
for (const route of ['/about/', '/about/help/', '/about/privacy/', '/about/accessibility/', '/settings/']) {
  test(`at most one nav item is aria-current: ${route}`, async ({ page }) => {
    await page.goto(route);
    const current = page.locator('nav[aria-label="Primary"] a[aria-current="page"]');
    expect(await current.count()).toBeLessThanOrEqual(1);
  });
}

// The /about/ ⊂ /about/help/ collision specifically: both routes must light
// their OWN item and nothing else. This is the regression that the `exact` flag
// on the About nav entry exists to prevent.
for (const [route, label] of [['/about/', 'About'], ['/about/help/', 'Help'], ['/about/privacy/', 'Privacy']] as const) {
  test(`nav lights exactly "${label}" on ${route}`, async ({ page }) => {
    await page.goto(route);
    const current = page.locator('nav[aria-label="Primary"] a[aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current).toHaveText(label);
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

// The visit-report FORM routes (confirm + first-report) ship EXACTLY ONE
// script: the external, self-hosted /confirm-camera.js (native camera capture;
// §13, ADR-0002). Same absolute contract as the list pages — one self-hosted
// script, never inline. The script no-ops on web (Capacitor absent), and the
// form is fully server-rendered and usable without it, which the axe scans of
// these routes already exercise.
for (const route of [
  '/contribute/confirm/c1111111-1111-1111-1111-111111111111/',
  '/contribute/report/11111111-1111-1111-1111-111111111111/accessible_parking/',
]) {
  test(`visit-report form ships only the self-hosted camera script: ${route}`, async ({ page }) => {
    await page.goto(route);
    const scripts = page.locator('script');
    await expect(scripts).toHaveCount(1);
    await expect(scripts.first()).toHaveAttribute('src', '/confirm-camera.js');
    expect((await scripts.first().textContent())?.trim() || '').toBe('');
  });
}

// The report HUB falls under the script-carve-out prefix (security.ts) but must
// still ship zero <script> — the CSP allows script there only because the
// prefix isn't segment-aware; the page itself stays zero-JS (§5).
test('report hub ships zero <script>', async ({ page }) => {
  await page.goto('/contribute/report/11111111-1111-1111-1111-111111111111/');
  await expect(page.locator('script')).toHaveCount(0);
});
