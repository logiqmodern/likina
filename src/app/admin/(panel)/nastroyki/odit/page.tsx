import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BackLink } from "@/components/admin/common/page-parts";
import { EmptyState, PageHeader } from "@/components/admin/forms";
import { Panel, PanelSkeleton } from "@/components/admin/ui";
import {
  AUDIT_ENTITY_LABELS,
  auditActionLabel,
  auditEntityHref,
  auditEntityLabel,
  formatDiff,
} from "@/components/admin/users/audit-labels";
import { getDb } from "@/db/client";
import { formatNumericDateTime, formatRecent } from "@/lib/admin-format";
import { adminSection } from "@/lib/admin-nav";
import { listAudit } from "@/server/admin/audit";
import { requireAdmin } from "@/server/admin/auth";

export const metadata: Metadata = { title: "Одит лог" };

const PAGE = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** §10.2.13: who did what, when — newest first. Owner and developer. */
export default function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PanelSkeleton rows={8} />}>
      <Audit searchParams={searchParams} />
    </Suspense>
  );
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function Audit({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin({ roles: adminSection("nastroyki").roles });
  const sp = await searchParams;
  const entity = Object.hasOwn(AUDIT_ENTITY_LABELS, one(sp.obekt)) ? one(sp.obekt) : "";
  const lastId = UUID.test(one(sp.posledno)) ? one(sp.posledno) : null;
  const paging = lastId !== null;
  const db = getDb();
  const now = new Date();

  // Keyset paging: (created_at, id) after the last row shown.
  let rows = await listAudit(db, { entity: entity || undefined, afterId: lastId ?? undefined, limit: PAGE + 1 });
  const hasMore = rows.length > PAGE;
  rows = rows.slice(0, PAGE);

  const last = rows[rows.length - 1];
  const nextHref = last
    ? `/admin/nastroyki/odit?${new URLSearchParams({ ...(entity ? { obekt: entity } : {}), posledno: last.id })}`
    : null;

  return (
    <>
      <BackLink href="/admin/nastroyki">Настройки</BackLink>
      <PageHeader title="Одит лог" description="Кой какво е променил и кога, най-новите първи. Часовете са по българско време." />

      <form method="get" className="flex flex-wrap items-end gap-2" aria-label="Филтър">
        <div className="min-w-0 flex-1 sm:max-w-sm">
          <label htmlFor="audit-entity" className="field-label">
            Покажи
          </label>
          <select id="audit-entity" name="obekt" defaultValue={entity} className="field-input appearance-auto">
            <option value="">Всичко</option>
            {Object.entries(AUDIT_ENTITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn-secondary min-h-11">
          Филтрирай
        </button>
        {entity || paging ? (
          <Link href="/admin/nastroyki/odit" className="btn border-0 bg-transparent text-ink underline-offset-4 hover:underline min-h-11">
            Изчисти
          </Link>
        ) : null}
      </form>

      {rows.length === 0 ? (
        <EmptyState>{paging ? "Няма по-стари записи." : "Още няма записи."}</EmptyState>
      ) : (
        <Panel className="p-2 sm:p-3">
          <ol className="flex flex-col divide-y divide-[#F1EBEF]" aria-label="Записи в одит лога">
            {rows.map((r) => {
              const href = auditEntityHref(r.entity, r.entityId);
              const diff = formatDiff(r.diff);
              return (
                <li
                  key={r.id}
                  className="grid gap-1.5 px-2 py-3 lg:grid-cols-[170px_minmax(0,220px)_minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-4"
                >
                  <div className="text-[14px]">
                    <time dateTime={r.createdAt.toISOString()} className="font-bold tabular-nums">
                      {formatRecent(r.createdAt, now)}
                    </time>
                    <span className="block text-[12px] text-muted tabular-nums">{formatNumericDateTime(r.createdAt)}</span>
                  </div>
                  <div className="break-all text-[14px] text-ink-2">{r.actor}</div>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[15px] font-bold">{auditActionLabel(r.action)}</span>
                    <span className="text-[13px] text-muted">
                      {auditEntityLabel(r.entity)}
                      {r.entityId ? (
                        <>
                          {" · "}
                          {href ? (
                            <Link href={href} className="link break-all">
                              {r.entityId}
                            </Link>
                          ) : (
                            <span className="break-all">{r.entityId}</span>
                          )}
                        </>
                      ) : href ? (
                        <>
                          {" · "}
                          <Link href={href} className="link">
                            отвори
                          </Link>
                        </>
                      ) : null}
                    </span>
                  </div>
                  {diff.length > 0 ? (
                    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 rounded-lg bg-[#F7F5F6] px-3 py-2 text-[13px]">
                      {diff.map((d) => (
                        <div key={d.key} className="contents">
                          <dt className="font-semibold text-muted">{d.key}</dt>
                          <dd className="break-words">{d.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <span className="hidden text-[13px] text-muted lg:block">—</span>
                  )}
                </li>
              );
            })}
          </ol>
        </Panel>
      )}

      <nav aria-label="Страници на одит лога" className="flex flex-wrap gap-2">
        {paging ? (
          <Link href={entity ? `/admin/nastroyki/odit?obekt=${encodeURIComponent(entity)}` : "/admin/nastroyki/odit"} className="btn btn-secondary min-h-11">
            ← Най-новите
          </Link>
        ) : null}
        {hasMore && nextHref ? (
          <Link href={nextHref} className="btn btn-secondary min-h-11">
            По-стари →
          </Link>
        ) : null}
      </nav>
    </>
  );
}
