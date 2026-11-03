import { hash, verify } from "@node-rs/argon2";

/**
 * Admin passwords: argon2id (the library default) with the OWASP minimum
 * profile — 19 MiB memory, 2 iterations, 1 lane.
 */
export const ARGON2_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export const PASSWORD_MIN_LENGTH = 12;
/** Upper bound so a huge input cannot be used to burn CPU. */
export const PASSWORD_MAX_LENGTH = 256;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

/** Never throws: a malformed stored hash counts as a mismatch. */
export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  if (password.length > PASSWORD_MAX_LENGTH) return false;
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * Burns the same time as a real check. Called when the e-mail is unknown so
 * the response time does not reveal which accounts exist.
 */
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hashPassword("dummy-password-that-never-matches");
  await verifyPassword(await dummyHash, password.slice(0, PASSWORD_MAX_LENGTH));
  return false;
}

/** Validation message for a new password, or null when acceptable. */
export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Паролата трябва да е поне ${PASSWORD_MIN_LENGTH} знака`;
  if (password.length > PASSWORD_MAX_LENGTH) return `Паролата може да е най-много ${PASSWORD_MAX_LENGTH} знака`;
  if (password.trim().length === 0) return "Паролата не може да е само интервали";
  return null;
}
