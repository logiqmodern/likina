import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { Secret, TOTP } from "otpauth";
import { serverEnv } from "@/lib/env";

/**
 * TOTP (RFC 6238) for admin 2FA: SHA-1, 6 digits, 30 s — what every
 * authenticator app supports. Secrets are stored encrypted with AES-256-GCM
 * under a key derived from SESSION_SECRET (HKDF-SHA256), as "iv:tag:ciphertext".
 */

export const TOTP_ISSUER = "Likina";
const DIGITS = 6;
const PERIOD = 30;

/** 160-bit secret, base32 (the format authenticator apps expect). */
export function generateTotpSecret(): string {
  return new Secret({ size: 20 }).base32;
}

function totpFor(secretBase32: string, label: string): TOTP {
  return new TOTP({
    issuer: TOTP_ISSUER,
    label,
    algorithm: "SHA1",
    digits: DIGITS,
    period: PERIOD,
    secret: Secret.fromBase32(secretBase32),
  });
}

/** otpauth:// URI for the QR code. */
export function totpUri(secretBase32: string, accountEmail: string): string {
  return totpFor(secretBase32, accountEmail).toString();
}

/** Accepts the current code and one step on either side (clock drift). */
export function verifyTotp(secretBase32: string, code: string, now: Date = new Date()): boolean {
  const token = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(token)) return false;
  return totpFor(secretBase32, "x").validate({ token, timestamp: now.getTime(), window: 1 }) !== null;
}

export const TOTP_PERIOD_SECONDS = 30;

/**
 * Like verifyTotp, but returns the absolute time step the code belongs to
 * (or null). Callers store the step and refuse any step ≤ the last one, so a
 * code cannot be replayed within its validity window.
 */
export function matchTotpStep(secretBase32: string, code: string, now: Date = new Date()): number | null {
  const token = code.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(token)) return null;
  const delta = totpFor(secretBase32, "x").validate({ token, timestamp: now.getTime(), window: 1 });
  if (delta === null) return null;
  return Math.floor(now.getTime() / 1000 / TOTP_PERIOD_SECONDS) + delta;
}

/** Current code — for tests. */
export function generateTotpCode(secretBase32: string, now: Date = new Date()): string {
  return totpFor(secretBase32, "x").generate({ timestamp: now.getTime() });
}

/** "ABCD EFGH …" for manual entry. */
export function formatSecretForDisplay(secretBase32: string): string {
  return secretBase32.replace(/(.{4})/g, "$1 ").trim();
}

// ── Encryption at rest ───────────────────────────────────

const HKDF_SALT = "lio-admin";
const HKDF_INFO = "totp-secret:v1";

export function deriveTotpKey(sessionSecret: string): Buffer {
  if (sessionSecret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return Buffer.from(hkdfSync("sha256", sessionSecret, HKDF_SALT, HKDF_INFO, 32));
}

/** Key from the environment; fails loudly when SESSION_SECRET is not configured. */
export function totpKeyFromEnv(): Buffer {
  const secret = serverEnv().SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set — required for admin 2FA (see .env.example)");
  return deriveTotpKey(secret);
}

export function encryptSecret(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((b) => b.toString("base64")).join(":");
}

/** Throws if the value was tampered with or encrypted under another key. */
export function decryptSecret(stored: string, key: Buffer): string {
  const parts = stored.split(":");
  if (parts.length !== 3) throw new Error("malformed encrypted secret");
  const [iv, tag, ciphertext] = parts.map((p) => Buffer.from(p, "base64")) as [Buffer, Buffer, Buffer];
  if (iv.length !== 12 || tag.length !== 16) throw new Error("malformed encrypted secret");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
