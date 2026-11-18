import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: '**/*.spec.js', reporter: 'list', workers: 2,
  use: { baseURL: 'http://127.0.0.1:4321/Blog/', trace: 'retain-on-failure', channel: process.env.PLAYWRIGHT_CHANNEL },
  webServer: { command: 'node scripts/site/serve-preview.js', url: 'http://127.0.0.1:4321/', reuseExistingServer: false, timeout: 30000 },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }, { name: 'mobile', use: { ...devices['Pixel 7'] } }],
});
