import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: {
    timeout: 6000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5199',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node server/index.js',
      env: {
        PORT: '3050',
        NODE_ENV: 'test',
        MONGO_URI: '',
        FRONTEND_URL: 'http://localhost:5199',
        SESSION_SECRET: 'local-test-secret-must-be-long-enough-32-chars',
      },
      port: 3050,
      reuseExistingServer: false,
      timeout: 15000,
    },
    {
      command: 'npx vite --port 5199 --strictPort',
      cwd: './client',
      env: {
        VITE_API_PROXY: 'http://localhost:3050',
      },
      port: 5199,
      reuseExistingServer: false,
      timeout: 15000,
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
