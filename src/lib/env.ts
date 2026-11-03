import { z } from "zod";

/**
 * Server-side environment, validated once and lazily so that importing a
 * module never fails at build time (Next.js imports route modules while
 * prerendering, when runtime secrets are not present).
 */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url(),
  DATABASE_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\//, "DATABASE_URL must be a postgres:// connection string"),

  // Phase 6 — e-mail (optional until then)
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  EMAIL_REPLY_TO: z.email().optional(),
  STUDIO_NOTIFY_EMAIL: z.email().optional(),
  ALERT_EMAIL: z.email().optional(),
  /** Resend webhook signing secret ("whsec_…") — delivery / bounce statuses */
  RESEND_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
  /** Bearer secret for /api/cron/* (Vercel Cron sends it automatically) */
  CRON_SECRET: z.string().min(16).optional(),

  // Phase 5 — admin sessions
  SESSION_SECRET: z.string().min(32, { error: "SESSION_SECRET must be at least 32 characters" }).optional(),
  /** Set only to create the first admin user at /admin/nastroyka; remove afterwards. */
  ADMIN_SETUP_TOKEN: z.string().min(24, { error: "ADMIN_SETUP_TOKEN must be at least 24 characters" }).optional(),

  // Phase 4 — anti-spam
  TURNSTILE_SECRET_KEY: z.string().min(1).optional(),

  // Phase 7 — measurement
  META_CAPI_ACCESS_TOKEN: z.string().min(1).optional(),
  META_TEST_EVENT_CODE: z.string().min(1).optional(),

  // Phase 9 — monitoring
  SENTRY_DSN: z.url().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Variables the site cannot run without. Any other variable is feature-specific. */
const REQUIRED_KEYS = new Set(["NODE_ENV", "APP_URL", "DATABASE_URL"]);

export interface ParsedServerEnv {
  env: ServerEnv;
  /** optional variables that were set but invalid — treated as unset (names only, never values) */
  invalidOptional: Array<{ key: string; message: string }>;
}

/**
 * Required variables must be valid (otherwise throws). An invalid OPTIONAL
 * variable (e.g. a too-short SESSION_SECRET) is dropped and reported instead:
 * the feature that needs it stays off (fails closed), the public site keeps working.
 */
export function parseServerEnvDetailed(source: Record<string, string | undefined>): ParsedServerEnv {
  // Treat empty strings from .env files as "not set".
  const cleaned: Record<string, string> = Object.fromEntries(
    Object.entries(source).filter((e): e is [string, string] => e[1] !== undefined && e[1] !== ""),
  );
  const shape = serverEnvSchema.shape;
  const invalidOptional: ParsedServerEnv["invalidOptional"] = [];
  for (const key of Object.keys(shape) as Array<keyof typeof shape>) {
    if (REQUIRED_KEYS.has(key) || cleaned[key] === undefined) continue;
    const r = shape[key].safeParse(cleaned[key]);
    if (!r.success) {
      invalidOptional.push({ key, message: r.error.issues[0]?.message ?? "invalid" });
      delete cleaned[key];
    }
  }
  const result = serverEnvSchema.safeParse(cleaned);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid server environment:\n${issues}`);
  }
  return { env: result.data, invalidOptional };
}

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  return parseServerEnvDetailed(source).env;
}

let cached: ParsedServerEnv | undefined;

/** On Vercel, APP_URL may be omitted and is derived from the deployment URL. */
export function withPlatformDefaults(source: Record<string, string | undefined>): Record<string, string | undefined> {
  if (source.APP_URL) return source;
  const host = source.VERCEL_PROJECT_PRODUCTION_URL ?? source.VERCEL_URL;
  return host ? { ...source, APP_URL: `https://${host}` } : source;
}

function load(): ParsedServerEnv {
  if (!cached) {
    cached = parseServerEnvDetailed(withPlatformDefaults(process.env));
    for (const p of cached.invalidOptional) {
      console.error(`[env] ${p.key} is set but invalid (${p.message}) — ignored; the feature that needs it is off`);
    }
  }
  return cached;
}

export function serverEnv(): ServerEnv {
  return load().env;
}

/** Names of optional variables that are set but invalid (for /api/health). */
export function invalidOptionalEnv(): string[] {
  return load().invalidOptional.map((p) => p.key);
}

/** All business logic runs in the studio's time zone; the database stores UTC. */
export const APP_TIME_ZONE = "Europe/Sofia";
