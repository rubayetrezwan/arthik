import { defineConfig, devices } from '@playwright/test'

const FLOWS = /flows\.spec\.ts$/

export default defineConfig({
  testDir: 'e2e',
  // The screenshot generator only runs when asked for: --grep @screenshots.
  grepInvert: process.argv.some((arg) => arg.includes('@screenshots')) ? undefined : /@screenshots/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173/arthik/',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/arthik/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  // The flows run on every project. The language, device, accessibility and offline suites
  // run on desktop Chrome, which resizes itself to each width they test.
  projects: [
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
    { name: 'desktop-firefox', use: { ...devices['Desktop Firefox'] }, testMatch: FLOWS },
    { name: 'desktop-safari', use: { ...devices['Desktop Safari'] }, testMatch: FLOWS },
    { name: 'ipad', use: { ...devices['iPad (gen 7)'] }, testMatch: FLOWS },
    { name: 'ipad-landscape', use: { ...devices['iPad (gen 7) landscape'] }, testMatch: FLOWS },
    { name: 'android', use: { ...devices['Pixel 7'] }, testMatch: /(flows|screenshots)\.spec\.ts$/ },
    { name: 'iphone', use: { ...devices['iPhone 14'] }, testMatch: FLOWS },
  ],
})
