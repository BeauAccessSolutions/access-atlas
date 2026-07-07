import { defineConfig, devices } from '@playwright/test';

// Accessibility testing is part of "done" (§5). This runs axe-core against the
// built site in CI. IMPORTANT: automated scanners catch ~40% of issues (§5) —
// passing here is necessary, NOT sufficient. Manual assistive-tech testing
// (NVDA, VoiceOver) is still required before shipping any user-facing feature.
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4321',
  },
  // Build + preview the static site, then test it as it will actually ship.
  webServer: {
    command: 'npm run build && npm run preview -- --port 4321',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
