import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.e2e.spec.ts', 'test/**/*.spec.ts'],
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@neeklo/contracts': path.resolve(__dirname, '../../packages/contracts/src'),
    },
  },
});
