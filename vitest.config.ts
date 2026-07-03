import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Exclude entry barrels and repo-only files (tests, notes) — none of
      // them ship in `dist`.
      exclude: ['**/*.test.ts', '**/index.ts'],
      reporter: ['text', 'html', 'lcov'],
    },
  },
});
