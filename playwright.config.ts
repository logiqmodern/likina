import { defineConfig, devices } from "@playwright/test";

/**
 * E2E against the production build (§17): `npm run build` first, then
 * `npm run e2e`. Uses its own database (E2E_DATABASE_URL), migrated and
 * seeded by e2e/global-setup.ts.
 */
import { E2E_ENV, E2E_PORT as PORT } from "./e2e/env";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: E2E_ENV.APP_URL,
    locale: "bg-BG",
    timezoneId: "Europe/Sofia",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, testMatch: /smoke/ },
  ],
  webServer: {
    command: "node .next/standalone/server.js",
    url: `${E2E_ENV.APP_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: { ...E2E_ENV, PORT: String(PORT), HOSTNAME: "127.0.0.1", NODE_ENV: "production" },
  },
});
