import { describe, expect, it } from "vitest";
import {
  decryptSecret,
  deriveTotpKey,
  encryptSecret,
  formatSecretForDisplay,
  generateTotpCode,
  generateTotpSecret,
  TOTP_ISSUER,
  totpUri,
  verifyTotp,
} from "./totp";

const KEY = deriveTotpKey("a".repeat(48));
const NOW = new Date("2026-10-12T08:00:10Z");

describe("TOTP", () => {
  it("generates a 160-bit base32 secret", () => {
    const s = generateTotpSecret();
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
    expect(generateTotpSecret()).not.toBe(s);
  });

  it("builds an otpauth URI with the studio as issuer", () => {
    const uri = totpUri("JBSWY3DPEHPK3PXP", "dev@example.com");
    expect(uri.startsWith("otpauth://totp/")).toBe(true);
    const url = new URL(uri);
    expect(url.searchParams.get("issuer")).toBe(TOTP_ISSUER);
    expect(url.searchParams.get("secret")).toBe("JBSWY3DPEHPK3PXP");
    expect(url.searchParams.get("digits")).toBe("6");
    expect(url.searchParams.get("period")).toBe("30");
    expect(decodeURIComponent(url.pathname)).toContain("dev@example.com");
  });

  it("accepts the current code and ±1 step, rejects ±2 steps", () => {
    const s = generateTotpSecret();
    const at = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);
    expect(verifyTotp(s, generateTotpCode(s, NOW), NOW)).toBe(true);
    expect(verifyTotp(s, generateTotpCode(s, at(-30)), NOW)).toBe(true);
    expect(verifyTotp(s, generateTotpCode(s, at(30)), NOW)).toBe(true);
    expect(verifyTotp(s, generateTotpCode(s, at(-60)), NOW)).toBe(false);
    expect(verifyTotp(s, generateTotpCode(s, at(60)), NOW)).toBe(false);
  });

  it("tolerates spaces but rejects malformed codes", () => {
    const s = generateTotpSecret();
    const code = generateTotpCode(s, NOW);
    expect(verifyTotp(s, `${code.slice(0, 3)} ${code.slice(3)}`, NOW)).toBe(true);
    expect(verifyTotp(s, "12345", NOW)).toBe(false);
    expect(verifyTotp(s, "abcdef", NOW)).toBe(false);
    expect(verifyTotp(s, "", NOW)).toBe(false);
  });

  it("formats the secret in groups of four", () => {
    expect(formatSecretForDisplay("ABCDEFGHIJKL")).toBe("ABCD EFGH IJKL");
  });
});

describe("secret encryption (AES-256-GCM, HKDF key)", () => {
  it("round-trips and uses a fresh IV each time", () => {
    const a = encryptSecret("JBSWY3DPEHPK3PXP", KEY);
    const b = encryptSecret("JBSWY3DPEHPK3PXP", KEY);
    expect(a).not.toBe(b);
    expect(a.split(":")).toHaveLength(3);
    expect(a).not.toContain("JBSWY3DPEHPK3PXP");
    expect(decryptSecret(a, KEY)).toBe("JBSWY3DPEHPK3PXP");
  });

  it("rejects a wrong key and tampered ciphertext", () => {
    const enc = encryptSecret("JBSWY3DPEHPK3PXP", KEY);
    expect(() => decryptSecret(enc, deriveTotpKey("b".repeat(48)))).toThrow();
    const [iv, tag, ct] = enc.split(":") as [string, string, string];
    const flipped = Buffer.from(ct, "base64");
    flipped[0] = flipped[0]! ^ 1;
    expect(() => decryptSecret([iv, tag, flipped.toString("base64")].join(":"), KEY)).toThrow();
    expect(() => decryptSecret("garbage", KEY)).toThrow();
  });

  it("derives a stable 32-byte key and refuses a short secret", () => {
    expect(deriveTotpKey("a".repeat(48)).equals(KEY)).toBe(true);
    expect(KEY).toHaveLength(32);
    expect(() => deriveTotpKey("too-short")).toThrow();
  });
});
