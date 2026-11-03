import { and, count, desc, eq } from "drizzle-orm";
import type { Database } from "@/db/client";
import { inquiries, inquiryStatus, inquiryType } from "@/db/schema";
import { writeAudit } from "./audit";

/* §10.2.4: inquiries (custom icon, contact, similar artwork) with a simple status. */

export type InquiryStatus = (typeof inquiryStatus.enumValues)[number];
export type InquiryTypeName = (typeof inquiryType.enumValues)[number];

export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  new: "Ново",
  in_progress: "В процес",
  done: "Приключено",
};

export const INQUIRY_TYPE_LABELS: Record<InquiryTypeName, string> = {
  custom_icon: "Икона по поръчка",
  contact: "Контакт",
  similar_artwork: "Подобна творба",
};

export async function listInquiries(
  db: Database,
  q: { status?: InquiryStatus; type?: InquiryTypeName; limit?: number; offset?: number } = {},
) {
  const where = and(q.status ? eq(inquiries.status, q.status) : undefined, q.type ? eq(inquiries.type, q.type) : undefined);
  const [items, [total], byStatus] = await Promise.all([
    db
      .select()
      .from(inquiries)
      .where(where)
      .orderBy(desc(inquiries.createdAt))
      .limit(Math.min(q.limit ?? 50, 200))
      .offset(q.offset ?? 0),
    db.select({ n: count() }).from(inquiries).where(where),
    db.select({ status: inquiries.status, n: count() }).from(inquiries).groupBy(inquiries.status),
  ]);
  const counts: Record<InquiryStatus, number> = { new: 0, in_progress: 0, done: 0 };
  for (const r of byStatus) counts[r.status] = r.n;
  return { items, total: total?.n ?? 0, counts };
}

export async function setInquiryStatus(
  db: Database,
  actor: string,
  input: { id: string; status: InquiryStatus },
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [before] = await tx.select({ status: inquiries.status }).from(inquiries).where(eq(inquiries.id, input.id)).for("update");
    if (!before) return false;
    if (before.status === input.status) return true;
    await tx.update(inquiries).set({ status: input.status }).where(eq(inquiries.id, input.id));
    await writeAudit(tx, {
      actor,
      action: "inquiry.status",
      entity: "inquiry",
      entityId: input.id,
      diff: { from: before.status, to: input.status },
    });
    return true;
  });
}

export async function countNewInquiries(db: Database): Promise<number> {
  const [row] = await db.select({ n: count() }).from(inquiries).where(eq(inquiries.status, "new"));
  return row?.n ?? 0;
}
