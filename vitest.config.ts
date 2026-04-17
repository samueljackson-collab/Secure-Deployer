import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/setup.ts',
    include: ['**/*.{test,spec}.{ts,tsx}'],
    // Re-enable coverage thresholds once baseline tests are established:
    // coverage: { thresholds: { lines: 70, functions: 70 } },
  },
});
