import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { inquiries } from "@/db/schema";
import { createTestDb, hasDatabase, resetDb } from "@/test/db";
import { saveInquiry, validateInquiry } from "./inquiries";

describe.skipIf(!hasDatabase)("inquiries (Postgres)", () => {
  const { db, pool } = hasDatabase ? createTestDb() : ({} as ReturnType<typeof createTestDb>);

  beforeEach(async () => {
    await resetDb(db);
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("stores a validated custom icon inquiry with a normalized phone", async () => {
    const result = validateInquiry("custom_icon", {
      name: "Мария Петрова",
      phone: "0887 123 456",
      email: "maria@example.com",
      subject: "Св. Богородица Умиление",
      message: "За подарък.",
    });
    expect(result.ok).toBe(true);
    if (!result.ok || result.spam) throw new Error("expected a valid, non-spam inquiry");

    const { id } = await saveInquiry(db, "custom_icon", result.data);
    const rows = await db.select().from(inquiries);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id, type: "custom_icon", status: "new" });
    expect(rows[0]!.payload).toMatchObject({ name: "Мария Петрова", phone: "+359887123456" });
  });
});
