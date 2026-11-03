import { and, desc, eq, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { auditLog } from "@/db/schema";

/** Anything with an insert builder: the db or an open transaction. */
type Writer = Pick<Database, "insert">;

export interface AuditEntry {
  /** admin e-mail, or "system" / "online" */
  actor: string;
  /** dotted verb, e.g. "booking.create", "package.adjust" */
  action: string;
  entity: string;
  entityId?: string | null;
  diff?: Record<string, unknown> | null;
}

/** §10.2.13: who did what, when. Never store health data or secrets in `diff`. */
export async function writeAudit(db: Writer, entry: AuditEntry): Promise<void> {
  await db.insert(auditLog).values({
    actor: entry.actor,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId ?? null,
    diff: entry.diff ?? null,
  });
}

export interface AuditQuery {
  entity?: string;
  entityId?: string;
  /** keyset pagination: rows after this one in (created_at desc, id desc) order — the last id shown */
  afterId?: string;
  limit?: number;
}

export async function listAudit(db: Database, q: AuditQuery = {}) {
  return db
    .select()
    .from(auditLog)
    .where(
      and(
        q.entity ? eq(auditLog.entity, q.entity) : undefined,
        q.entityId ? eq(auditLog.entityId, q.entityId) : undefined,
        // Exact cursor: compares in the database (microseconds), ties broken by id.
        q.afterId
          ? sql`(${auditLog.createdAt}, ${auditLog.id}) < (select a.created_at, a.id from audit_log a where a.id = ${q.afterId})`
          : undefined,
      ),
    )
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(Math.min(q.limit ?? 50, 200));
}
