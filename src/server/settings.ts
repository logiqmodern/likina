import type { Database } from "@/db/client";
import { settings as settingsTable } from "@/db/schema";
import { resolveSettings, type Settings } from "@/domain/settings";

/** Shop settings with defaults; invalid stored values are reported once and ignored. */
export async function loadSettings(db: Database): Promise<Settings> {
  const rows = await db.select({ key: settingsTable.key, value: settingsTable.value }).from(settingsTable);
  const { settings, invalidKeys } = resolveSettings(rows);
  if (invalidKeys.length) console.error(`[settings] invalid stored values ignored: ${invalidKeys.join(", ")}`);
  return settings;
}
