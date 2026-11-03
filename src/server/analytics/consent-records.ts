import type { Database } from "@/db/client";
import { consentRecords } from "@/db/schema";
import { CONSENT_VERSION } from "@/lib/analytics/consent";

/** Proof of cookie consent (GDPR art. 7(1)): what was chosen and when, under the current banner version. */
export async function recordConsent(
  db: Database,
  input: { consentId: string; analytics: boolean; marketing: boolean; now: Date },
): Promise<void> {
  await db.insert(consentRecords).values({
    consentId: input.consentId,
    version: CONSENT_VERSION,
    analytics: input.analytics,
    marketing: input.marketing,
    createdAt: input.now,
  });
}
