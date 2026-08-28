import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['shared/**/*.js', 'background/**/*.js', 'popup/**/*.js', 'dashboard/**/*.js'],
      exclude: ['shared/vendor/**', 'shared/lucide.min.js', 'node_modules/**', 'tests/**']
    }
  }
});
