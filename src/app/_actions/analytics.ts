"use server";

import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { getDb } from "@/db/client";
import { CONSENT_COOKIE, CONSENT_MAX_AGE_S, parseConsent, serializeConsent } from "@/lib/analytics/consent";
import { recordConsent } from "@/server/analytics/consent-records";

/** Cookie banner: saves the visitor's choice — cookie (read by the browser and the server) + a record as proof. */
export async function saveConsentAction(choice: { analytics: boolean; marketing: boolean }): Promise<{ ok: true; value: string }> {
  const analytics = choice?.analytics === true;
  const marketing = choice?.marketing === true;
  const jar = await cookies();
  const previous = parseConsent(jar.get(CONSENT_COOKIE)?.value);
  const id = previous?.id ?? randomBytes(12).toString("base64url");
  const now = new Date();
  const value = serializeConsent({ analytics, marketing, at: now, id });
  jar.set(CONSENT_COOKIE, value, {
    httpOnly: false, // the browser decides from it whether to load GA4 / Pixel
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CONSENT_MAX_AGE_S,
  });
  try {
    await recordConsent(getDb(), { consentId: id, analytics, marketing, now });
  } catch (error) {
    console.error("[consent] record failed", error);
  }
  return { ok: true, value };
}
