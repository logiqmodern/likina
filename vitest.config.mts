import path from "node:path";
import { defineConfig } from "vitest/config";

const alias = { "@": path.resolve(import.meta.dirname, "src") };

export default defineConfig({
  resolve: { alias },
  test: {
    // Business logic always runs in the studio's zone; tests must not depend on the host zone.
    env: { TZ: "UTC" },
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
          // e2e/ is Playwright
          exclude: ["src/**/*.int.test.ts"],
          env: { TZ: "UTC" },
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          include: ["src/**/*.int.test.ts"],
          // Integration files share one database and truncate it: run them one at a time.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 30_000,
          // Server env for code paths that read it (e-mail links, token box). Test values only.
          env: {
            TZ: "UTC",
            APP_URL: "https://test.lejishiotslabvash.com",
            SESSION_SECRET: "integration-test-session-secret-0123456789",
          },
        },
      },
    ],
  },
});
