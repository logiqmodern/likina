import { describe, expect, it } from "vitest";
import { deriveTokenBoxKey, generateToken, openToken, sealToken } from "./crypto";

describe("manage token box", () => {
  const key = deriveTokenBoxKey("x".repeat(40));
  it("round-trips and never stores the plain token", () => {
    const token = generateToken();
    const sealed = sealToken(token, key);
    expect(sealed).not.toContain(token);
    expect(openToken(sealed, key)).toBe(token);
    expect(sealToken(token, key)).not.toBe(sealed); // random IV
  });
  it("another key or a damaged box gives null", () => {
    const sealed = sealToken(generateToken(), key);
    expect(openToken(sealed, deriveTokenBoxKey("y".repeat(40)))).toBeNull();
    expect(openToken(sealed.slice(0, -2) + "AA", key)).toBeNull();
    expect(openToken("garbage", key)).toBeNull();
  });
  it("refuses short secrets", () => {
    expect(() => deriveTokenBoxKey("short")).toThrow();
  });
});
