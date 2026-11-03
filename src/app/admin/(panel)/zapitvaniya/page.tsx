import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LinkTabs } from "@/components/admin/common/link-tabs";
import { Pagination } from "@/components/admin/common/pagination";
import { EmptyState } from "@/components/admin/forms";
import { InquiryStatusButtons } from "@/components/admin/inquiries/status-buttons";
import { Panel, PanelSkeleton } from "@/components/admin/ui";
import { getDb } from "@/db/client";
import { formatPhone, normalizePhone } from "@/domain/phone";
import { formatRecent } from "@/lib/admin-format";
import { adminSection } from "@/lib/admin-nav";
import { requireAdmin } from "@/server/admin/auth";
import {
  INQUIRY_STATUS_LABELS,
  INQUIRY_TYPE_LABELS,
  type InquiryStatus,
  type InquiryTypeName,
  listInquiries,
} from "@/server/admin/inquiries";

export const metadata: Metadata = { title: "Запитвания" };

const PAGE_SIZE = 50;

/** URL slug ↔ status */
const STATUS_SLUGS: Record<string, InquiryStatus> = { "": "new", "v-proces": "in_progress", priklyucheno: "done" };
const TYPES = Object.keys(INQUIRY_TYPE_LABELS) as InquiryTypeName[];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function InquiriesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<PanelSkeleton rows={6} />}>
      <Inquiries searchParams={searchParams} />
    </Suspense>
  );
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

function href(p: { status?: string; vid?: string; str?: number }) {
  const s = new URLSearchParams();
  if (p.status) s.set("status", p.status);
  if (p.vid) s.set("vid", p.vid);
  if (p.str && p.str > 1) s.set("str", String(p.str));
  const qs = s.toString();
  return qs ? `/admin/zapitvaniya?${qs}` : "/admin/zapitvaniya";
}

async function Inquiries({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin({ roles: adminSection("zapitvaniya").roles });
  const sp = await searchParams;
  const now = new Date();
  const statusSlug = one(sp.status) in STATUS_SLUGS ? one(sp.status) : "";
  const status = STATUS_SLUGS[statusSlug]!;
  const rawType = one(sp.vid);
  const type = TYPES.includes(rawType as InquiryTypeName) ? (rawType as InquiryTypeName) : undefined;
  const pageNum = Number(one(sp.str));
  const page = Number.isInteger(pageNum) && pageNum >= 1 ? pageNum : 1;

  const { items, total, counts } = await listInquiries(getDb(), {
    status,
    type,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  return (
    <>
      <div className="flex flex-col gap-3">
        <LinkTabs
          label="Статус на запитванията"
          tabs={Object.entries(STATUS_SLUGS).map(([slug, s]) => ({
            href: href({ status: slug, vid: type }),
            label: INQUIRY_STATUS_LABELS[s],
            count: counts[s],
            current: slug === statusSlug,
          }))}
        />
        <nav aria-label="Вид запитване" className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
          <ul className="flex w-max gap-1.5">
            {[{ value: "", label: "Всички видове" }, ...TYPES.map((t) => ({ value: t, label: INQUIRY_TYPE_LABELS[t] }))].map(
              (t) => {
                const current = (type ?? "") === t.value;
                return (
                  <li key={t.value || "all"}>
                    <Link
                      href={href({ status: statusSlug, vid: t.value })}
                      aria-current={current ? "page" : undefined}
                      className={`flex min-h-11 items-center whitespace-nowrap rounded-full border px-3.5 text-sm font-bold ${
                        current ? "border-ink bg-blush-100 text-ink" : "border-[#E2D6DE] bg-white text-ink-2 hover:bg-blush-50"
                      }`}
                    >
                      {t.label}
                    </Link>
                  </li>
                );
              },
            )}
          </ul>
        </nav>
      </div>

      <h2 className="sr-only">
        {INQUIRY_STATUS_LABELS[status]}
        {type ? ` · ${INQUIRY_TYPE_LABELS[type]}` : ""}
      </h2>
      <p className="text-[15px] tabular-nums text-muted" aria-live="polite">
        {total} {total === 1 ? "запитване" : "запитвания"} · най-новите първи
      </p>

      {items.length === 0 ? (
        <EmptyState>Няма запитвания тук.</EmptyState>
      ) : (
        <ul className="grid gap-3 xl:grid-cols-2">
          {items.map((q) => (
            <li key={q.id}>
              <Panel aria-labelledby={`inq-${q.id}`} className="flex h-full flex-col gap-3 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 id={`inq-${q.id}`} className="text-xs font-extrabold uppercase tracking-[0.06em] text-muted">
                    {INQUIRY_TYPE_LABELS[q.type]}
                  </h3>
                  <time dateTime={q.createdAt.toISOString()} className="text-[13px] tabular-nums text-muted">
                    {formatRecent(q.createdAt, now)}
                  </time>
                </div>
                <PayloadList payload={q.payload} />
                <InquiryStatusButtons id={q.id} status={q.status} />
              </Panel>
            </li>
          ))}
        </ul>
      )}

      {total > PAGE_SIZE ? (
        <Panel>
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            hrefFor={(p) => href({ status: statusSlug, vid: type, str: p })}
          />
        </Panel>
      ) : null}
    </>
  );
}

const LABELS: Record<string, string> = {
  name: "Име",
  phone: "Телефон",
  email: "Имейл",
  company: "Фирма",
  city: "Град",
  callbackTime: "Удобно време за обаждане",
  message: "Съобщение",
};
const ORDER = ["name", "phone", "email", "company", "city", "callbackTime", "message"];

function PayloadValue({ field, value }: { field: string; value: string }) {
  if (field === "phone") {
    const e164 = normalizePhone(value);
    return (
      <a
        href={`tel:${e164 ?? value.replace(/\s/g, "")}`}
        className="link inline-flex min-h-11 items-center tabular-nums sm:min-h-0"
      >
        {e164 ? formatPhone(e164) : value}
      </a>
    );
  }
  if (field === "email") {
    return (
      <a href={`mailto:${value}`} className="link inline-flex min-h-11 items-center break-all sm:min-h-0">
        {value}
      </a>
    );
  }
  return <span className="whitespace-pre-line break-words">{value}</span>;
}

function PayloadList({ payload }: { payload: Record<string, unknown> }) {
  const entries = Object.entries(payload)
    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== "")
    .map(([k, v]) => [k, typeof v === "string" ? v.trim() : JSON.stringify(v)] as const)
    .sort(([a], [b]) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99));
  if (entries.length === 0) return <p className="text-[15px] text-muted">Празно запитване.</p>;
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-[15px] sm:grid-cols-[minmax(0,150px)_minmax(0,1fr)]">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-[13px] font-semibold text-muted sm:pt-0.5">{LABELS[k] ?? k}</dt>
          <dd className={`mb-1 min-w-0 sm:mb-0 ${k === "name" ? "font-bold" : ""}`}>
            <PayloadValue field={k} value={v} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
