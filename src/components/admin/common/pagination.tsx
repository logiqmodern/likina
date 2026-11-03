import Link from "next/link";

/**
 * Server-rendered pager for admin lists: "Показани 51–100 от 186" + page links.
 * Shared by the bookings, customers and inquiries lists.
 */
export function Pagination({
  page,
  pageSize,
  total,
  hrefFor,
  label = "Страници",
}: {
  page: number;
  pageSize: number;
  total: number;
  hrefFor: (page: number) => string;
  label?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);
  const summary =
    total === 0
      ? "Няма резултати"
      : first > total
        ? `Няма резултати на тази страница (общо ${total})`
        : `Показани ${first}–${last} от ${total}`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm sm:px-5">
      <p className="tabular-nums text-muted">{summary}</p>
      {pages > 1 ? (
        <nav aria-label={label} className="flex flex-wrap items-center gap-1 tabular-nums">
          <PageLink href={page > 1 ? hrefFor(page - 1) : null} aria-label="Предишна страница">
            <Chevron dir="left" />
          </PageLink>
          {pageWindow(page, pages).map((p, i) =>
            p === null ? (
              <span key={`gap-${i}`} className="px-1 text-muted" aria-hidden="true">
                …
              </span>
            ) : p === page ? (
              <span
                key={p}
                aria-current="page"
                className="flex size-11 items-center justify-center rounded-xl bg-ink text-sm font-extrabold text-white"
              >
                {p}
              </span>
            ) : (
              <PageLink key={p} href={hrefFor(p)} aria-label={`Страница ${p}`}>
                {p}
              </PageLink>
            ),
          )}
          <PageLink href={page < pages ? hrefFor(page + 1) : null} aria-label="Следваща страница">
            <Chevron dir="right" />
          </PageLink>
        </nav>
      ) : null}
    </div>
  );
}

function PageLink({ href, children, ...rest }: { href: string | null; children: React.ReactNode; "aria-label": string }) {
  const cls = "flex size-11 items-center justify-center rounded-xl border border-[#ECE6EA] bg-white text-sm font-bold";
  if (!href) {
    return (
      <span className={`${cls} text-[#B9A9B4]`} aria-disabled="true" {...rest}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={`${cls} hover:bg-blush-50`} {...rest}>
      {children}
    </Link>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d={dir === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 1 … 4 5 6 … 19 */
function pageWindow(page: number, pages: number): Array<number | null> {
  const wanted = new Set([1, pages, page - 1, page, page + 1]);
  const list = [...wanted].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
  const out: Array<number | null> = [];
  for (const p of list) {
    const prev = out[out.length - 1];
    if (typeof prev === "number" && p - prev > 1) out.push(null);
    out.push(p);
  }
  return out;
}
