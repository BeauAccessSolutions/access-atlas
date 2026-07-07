import { defineConfig } from 'vitest/config';

// Fast, pure-TS unit tests for the safety-critical core (labeling vocabulary +
// consensus formula). Kept separate from the Playwright a11y suite (tests/a11y).
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
