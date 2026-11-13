import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { LinkTabs } from "@/components/admin/common/link-tabs";
import { Pagination } from "@/components/admin/common/pagination";
import { EmptyState, PageHeader } from "@/components/admin/forms";
import { Panel, PanelSkeleton, StatusChip } from "@/components/admin/ui";
import { getDb } from "@/db/client";
import { formatDimensions } from "@/domain/artwork-size";
import { formatEur } from "@/domain/pricing";
import { adminSection } from "@/lib/admin-nav";
import { mediaSrc } from "@/lib/media";
import { requireAdmin } from "@/server/admin/auth";
import { ARTWORK_STATUS_LABELS, listArtworks, type ArtworkStatusName } from "@/server/admin/artworks";

export const metadata: Metadata = { title: "Творби" };

const PAGE_SIZE = 60;

/** URL slug ↔ status ("" = the default tab) */
const STATUS_SLUGS: Record<string, ArtworkStatusName> = {
  "": "available",
  prodadeni: "sold",
  rezervirani: "reserved",
  chernovi: "draft",
  skriti: "hidden",
};

const STATUS_CHIP: Record<ArtworkStatusName, string> = {
  available: "bg-[#E6F1E3] text-[#2F5A26]",
  reserved: "bg-[#FBEFD5] text-[#7A5310]",
  sold: "bg-[#EEE9E2] text-muted",
  draft: "bg-[#EEE9E2] text-muted",
  hidden: "bg-[#EEE9E2] text-muted",
};

const TAB_LABELS: Record<ArtworkStatusName, string> = {
  available: "Налични",
  sold: "Продадени",
  reserved: "Резервирани",
  draft: "Чернови",
  hidden: "Скрити",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() ?? "";

function href(p: { status?: string; str?: number }) {
  const s = new URLSearchParams();
  if (p.status) s.set("status", p.status);
  if (p.str && p.str > 1) s.set("str", String(p.str));
  const qs = s.toString();
  return qs ? `/admin/tvorbi?${qs}` : "/admin/tvorbi";
}

export default function ArtworksPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <PageHeader
        title="Творби"
        description="Всички творби от стария сайт са тук. Редакцията (снимки, цена, „продадена“) идва в следващата стъпка."
      />
      <Suspense fallback={<PanelSkeleton rows={6} />}>
        <Artworks searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Artworks({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin({ roles: adminSection("tvorbi").roles });
  const sp = await searchParams;
  const statusSlug = one(sp.status) in STATUS_SLUGS ? one(sp.status) : "";
  const status = STATUS_SLUGS[statusSlug]!;
  const pageNum = Number(one(sp.str));
  const page = Number.isInteger(pageNum) && pageNum >= 1 ? pageNum : 1;
  const { items, total, counts } = await listArtworks(getDb(), { status, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });

  return (
    <div className="flex flex-col gap-4">
      <LinkTabs
        label="Статус на творбите"
        tabs={Object.entries(STATUS_SLUGS).map(([slug, s]) => ({
          href: href({ status: slug }),
          label: TAB_LABELS[s],
          count: counts[s],
          current: slug === statusSlug,
        }))}
      />
      <p className="text-[15px] tabular-nums text-muted" aria-live="polite">
        {total} {total === 1 ? "творба" : "творби"}
      </p>

      {items.length === 0 ? (
        <EmptyState>Няма творби тук.</EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((a) => {
            const size = formatDimensions(a, "bg");
            return (
              <li key={a.id}>
                <Panel className="flex h-full flex-col overflow-hidden">
                  <div className="relative aspect-square bg-[#F4EFE8]">
                    {a.coverMediaId ? (
                      <Image src={mediaSrc(a.coverMediaId)} alt="" fill sizes="(min-width: 1280px) 20vw, (min-width: 640px) 33vw, 50vw" className="object-contain" />
                    ) : (
                      <span className="absolute inset-0 grid place-items-center text-sm text-muted">Без снимка</span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-1.5 p-3">
                    <h3 className="text-[15px] font-bold leading-snug text-ink">{a.titleBg}</h3>
                    <p className="text-[13px] text-muted">
                      {a.artistName ?? "Без автор"}
                      {a.kind === "print" ? " · арт принт" : ""}
                    </p>
                    <p className="text-[15px] font-bold tabular-nums text-ink">{a.priceCents !== null ? formatEur(a.priceCents) : "Без цена"}</p>
                    {size ? <p className="text-[13px] tabular-nums text-ink-2">{size}</p> : null}
                    <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                      <StatusChip label={ARTWORK_STATUS_LABELS[a.status]} className={STATUS_CHIP[a.status]} />
                      {a.sizeNeedsCheck ? <StatusChip label="Провери размера" className="bg-[#FBEFD5] text-[#7A5310]" /> : null}
                      {!a.hasEnglish ? <StatusChip label="EN липсва" /> : null}
                    </div>
                  </div>
                </Panel>
              </li>
            );
          })}
        </ul>
      )}

      {total > PAGE_SIZE ? (
        <Panel>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p: number) => href({ status: statusSlug, str: p })} />
        </Panel>
      ) : null}
    </div>
  );
}
