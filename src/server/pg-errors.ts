/** Postgres SQLSTATE of an error thrown by node-postgres (possibly wrapped by Drizzle). */
export function pgCode(error: unknown): string | undefined {
  for (let e: unknown = error; e && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return undefined;
}

export const PG = {
  uniqueViolation: "23505",
  foreignKeyViolation: "23503",
  checkViolation: "23514",
  exclusionViolation: "23P01",
  deadlock: "40P01",
  serializationFailure: "40001",
} as const;
