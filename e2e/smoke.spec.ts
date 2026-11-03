import { expect, test } from "@playwright/test";

// Phase 0 smoke: the app starts, the database answers, the admin is closed.
test("health check answers ok", async ({ request }) => {
  const r = await request.get("/api/health");
  expect(r.ok()).toBe(true);
  expect(await r.json()).toMatchObject({ db: "ok" });
});

test("home page renders", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("admin without a session goes to the login page", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/vhod$/);
});
