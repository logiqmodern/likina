import { eq } from "drizzle-orm";
import { type Contacts, CONTACTS_DEFAULT, resolveContacts } from "@/domain/contacts";
import type { Database } from "@/db/client";
import { settings as settingsTable } from "@/db/schema";
import { serverEnv } from "@/lib/env";
import { loadSettings } from "../settings";
import { deriveTokenBoxKey, sealToken } from "../crypto";

/*
 * E-mail configuration resolved from env + CMS. Must work outside Next.js
 * (the worker), so nothing here uses `use cache` / next/cache.
 */

type Reader = Pick<Database, "select">;

export const DEFAULT_FROM = "Likina <shop@likina.com>";

/** Seller contacts straight from the database (no Next cache). */
export async function loadContacts(db: Reader): Promise<Contacts> {
  try {
    const [row] = await db.select({ value: settingsTable.value }).from(settingsTable).where(eq(settingsTable.key, "contacts"));
    return resolveContacts(row?.value);
  } catch {
    return CONTACTS_DEFAULT;
  }
}

export interface EmailConfig {
  from: string;
  replyTo: string;
  /** seller notifications; null = none configured */
  seller: string | null;
  /** developer alerts; null = log only */
  alert: string | null;
  appUrl: string;
  contacts: Contacts;
}

export async function loadEmailConfig(db: Database): Promise<EmailConfig> {
  const env = serverEnv();
  const [contacts, settings] = await Promise.all([loadContacts(db), loadSettings(db)]);
  return {
    from: env.EMAIL_FROM ?? DEFAULT_FROM,
    replyTo: env.EMAIL_REPLY_TO ?? contacts.email,
    seller: settings.sellerEmail ?? env.STUDIO_NOTIFY_EMAIL ?? contacts.email ?? null,
    alert: env.ALERT_EMAIL ?? null,
    appUrl: env.APP_URL.replace(/\/$/, ""),
    contacts,
  };
}

/** Key for the encrypted copy of manage tokens; null when SESSION_SECRET is not set. */
export function tokenBoxKey(): Buffer | null {
  const secret = serverEnv().SESSION_SECRET;
  return secret ? deriveTokenBoxKey(secret) : null;
}

export function fullAddress(c: Pick<Contacts, "street" | "city">): string {
  return `${c.street}, ${c.city}`;
}

/** Encrypted copy of a fresh order token for later e-mails; null without SESSION_SECRET. */
export function sealOrderToken(token: string): string | null {
  const key = tokenBoxKey();
  return key ? sealToken(token, key) : null;
}
