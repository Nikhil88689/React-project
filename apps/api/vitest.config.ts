import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    env: {
      NODE_ENV: 'test',
      JWT_ACCESS_SECRET: 'test-access-secret-test-access-secret',
      JWT_REFRESH_SECRET: 'test-refresh-secret-test-refresh-secret',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5433/recruitflow_test',
      LOG_LEVEL: 'silent',
    },
  },
});
