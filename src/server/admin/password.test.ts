import { describe, expect, it } from "vitest";
import { hashPassword, PASSWORD_MAX_LENGTH, passwordProblem, verifyAgainstDummy, verifyPassword } from "./password";

describe("admin passwords", () => {
  it("hashes with argon2id and the agreed parameters", async () => {
    const h = await hashPassword("correct horse battery");
    expect(h).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  });

  it("verifies the right password and rejects others", async () => {
    const h = await hashPassword("correct horse battery");
    expect(await verifyPassword(h, "correct horse battery")).toBe(true);
    expect(await verifyPassword(h, "correct horse batterY")).toBe(false);
    expect(await verifyPassword(h, "")).toBe(false);
  });

  it("uses a fresh salt for every hash", async () => {
    expect(await hashPassword("same password!")).not.toBe(await hashPassword("same password!"));
  });

  it("treats a malformed stored hash and over-long input as a mismatch (never throws)", async () => {
    expect(await verifyPassword("not-a-hash", "whatever")).toBe(false);
    const h = await hashPassword("x".repeat(PASSWORD_MAX_LENGTH));
    expect(await verifyPassword(h, "x".repeat(PASSWORD_MAX_LENGTH + 1))).toBe(false);
  });

  it("dummy verification always fails", async () => {
    expect(await verifyAgainstDummy("dummy-password-that-never-matches")).toBe(false);
  });

  it("requires at least 12 characters for a new password", () => {
    expect(passwordProblem("short")).toMatch(/поне 12/);
    expect(passwordProblem("            ")).toMatch(/интервали/);
    expect(passwordProblem("x".repeat(257))).toMatch(/най-много/);
    expect(passwordProblem("дълга-парола-123")).toBeNull();
  });
});
