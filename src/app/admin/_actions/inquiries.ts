"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { type ActionResult, formString, runAdminAction } from "@/server/admin/action-result";
import { INQUIRY_STATUS_LABELS, type InquiryStatus, setInquiryStatus } from "@/server/admin/inquiries";

/* Inquiry status (§10.2.9): new → in progress → done. Every admin role. */

const uuid = z.string().uuid();
const STATUSES = Object.keys(INQUIRY_STATUS_LABELS) as InquiryStatus[];

/** Form: id, status (new | in_progress | done). */
export async function setInquiryStatusAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  return runAdminAction<null>({}, async ({ db, actor }) => {
    const id = uuid.safeParse(formString(fd, "id"));
    const status = formString(fd, "status") as InquiryStatus;
    if (!id.success || !STATUSES.includes(status)) return { ok: false, message: "Запитването не е намерено." };
    const found = await setInquiryStatus(db, actor, { id: id.data, status });
    if (!found) return { ok: false, message: "Запитването не е намерено." };
    refresh();
    return { ok: true, data: null, message: `Статус: ${INQUIRY_STATUS_LABELS[status]}.` };
  });
}
