import { describe, expect, it } from "vitest";
import { parseServerEnv, parseServerEnvDetailed, withPlatformDefaults } from "./env";

const valid = {
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgres://app:app@localhost:5432/app",
};

describe("parseServerEnv", () => {
  it("accepts the minimal required variables and defaults NODE_ENV", () => {
    const env = parseServerEnv(valid);
    expect(env.NODE_ENV).toBe("development");
    expect(env.DATABASE_URL).toBe(valid.DATABASE_URL);
  });

  it("treats empty strings as unset optional values", () => {
    const env = parseServerEnv({ ...valid, RESEND_API_KEY: "", EMAIL_REPLY_TO: "" });
    expect(env.RESEND_API_KEY).toBeUndefined();
    expect(env.EMAIL_REPLY_TO).toBeUndefined();
  });

  it("rejects a non-postgres database URL", () => {
    expect(() => parseServerEnv({ ...valid, DATABASE_URL: "mysql://x" })).toThrow(/DATABASE_URL/);
  });

  it("rejects a missing APP_URL with a readable message", () => {
    expect(() => parseServerEnv({ DATABASE_URL: valid.DATABASE_URL })).toThrow(/APP_URL/);
  });

  it("drops an invalid optional variable instead of failing the whole site", () => {
    const r = parseServerEnvDetailed({ ...valid, SESSION_SECRET: "too-short", ADMIN_SETUP_TOKEN: "x" });
    expect(r.env.SESSION_SECRET).toBeUndefined();
    expect(r.env.ADMIN_SETUP_TOKEN).toBeUndefined();
    expect(r.env.DATABASE_URL).toBe(valid.DATABASE_URL);
    expect(r.invalidOptional.map((p) => p.key)).toEqual(["SESSION_SECRET", "ADMIN_SETUP_TOKEN"]);
    expect(JSON.stringify(r.invalidOptional)).not.toContain("too-short"); // never the value
  });

  it("keeps a valid SESSION_SECRET", () => {
    const secret = "x".repeat(32);
    expect(parseServerEnv({ ...valid, SESSION_SECRET: secret }).SESSION_SECRET).toBe(secret);
  });
});

describe("withPlatformDefaults", () => {
  it("derives APP_URL from the Vercel production URL, then the deployment URL", () => {
    expect(withPlatformDefaults({ VERCEL_PROJECT_PRODUCTION_URL: "a.vercel.app", VERCEL_URL: "b.vercel.app" }).APP_URL).toBe(
      "https://a.vercel.app",
    );
    expect(withPlatformDefaults({ VERCEL_URL: "b.vercel.app" }).APP_URL).toBe("https://b.vercel.app");
  });

  it("never overrides an explicit APP_URL", () => {
    expect(withPlatformDefaults({ APP_URL: "https://x.bg", VERCEL_URL: "b.vercel.app" }).APP_URL).toBe("https://x.bg");
  });
});
