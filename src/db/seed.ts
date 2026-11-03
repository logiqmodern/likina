import type { Database } from "./client";
import { settings } from "./schema";
import { CONTACTS_DEFAULT } from "@/domain/contacts";

/**
 * Initial data. Idempotent and non-destructive: existing rows are never
 * overwritten, so running it again after admin edits is safe. The catalog
 * (94 artworks) comes from the WooCommerce import (Phase 3), not from here.
 */
export async function seed(db: Database): Promise<{ settings: number }> {
  const inserted = await db
    .insert(settings)
    .values([{ key: "contacts", value: CONTACTS_DEFAULT }])
    .onConflictDoNothing({ target: settings.key })
    .returning({ key: settings.key });
  return { settings: inserted.length };
}
