import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";

/** 32 random bytes, URL-safe (43 chars). §14: ≥ 32 bytes. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Manage-link tokens are stored only as their hash. */
export function generateManageToken(): { token: string; hash: string } {
  const token = generateToken();
  return { token, hash: sha256(token) };
}

/** Rejects obviously malformed tokens before touching the database. */
export function isWellFormedToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

/*
 * Manage tokens are looked up by hash; a copy is kept encrypted so that
 * e-mails sent later (reminders) can still carry the manage link.
 * AES-256-GCM, key = HKDF-SHA256(SESSION_SECRET) with its own label, stored as
 * "iv.tag.ciphertext" (base64url).
 */
const TOKEN_BOX_INFO = "reducta/manage-token-box/v1";

export function deriveTokenBoxKey(secret: string): Buffer {
  if (secret.length < 32) throw new Error("secret must be at least 32 characters");
  return Buffer.from(hkdfSync("sha256", secret, "reducta", TOKEN_BOX_INFO, 32));
}

export function sealToken(token: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString("base64url")).join(".");
}

/** null when the box was sealed with another key or is damaged. */
export function openToken(sealed: string, key: Buffer): string | null {
  const parts = sealed.split(".");
  if (parts.length !== 3) return null;
  try {
    const [iv, tag, body] = parts.map((p) => Buffer.from(p, "base64url")) as [Buffer, Buffer, Buffer];
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
