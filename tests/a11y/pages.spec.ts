import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Every user-facing route gets an automated axe scan against WCAG 2.2 A/AA (§5).
// Add new routes here as they are built. Keep this list in sync with the seed
// so detail pages are covered too.
const ROUTES = [
  '/',
  '/places/',
  '/providers/',
  '/about/privacy/',
  // seeded detail pages (ids from supabase/seed.sql + src/lib/seed.ts)
  '/places/11111111-1111-1111-1111-111111111111/',
  '/providers/33333333-3333-3333-3333-333333333333/',
];

for (const route of ROUTES) {
  test(`no axe violations: ${route}`, async ({ page }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
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
