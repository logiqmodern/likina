import Link from "next/link";
import type { ReactNode } from "react";
import { formatNumericDateTime } from "@/lib/admin-format";
export const STATUS_CHIP_CLASS = "inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold";
export interface StatusInfo {
  label: string;
  className: string;
  note?: string;
}

/** Small server-rendered pieces shared by the content admin pages. */

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="link flex min-h-11 w-fit items-center text-[15px]">
      ← {children}
    </Link>
  );
}

export function SuccessNotice({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="rounded-xl border border-success/30 bg-[#E3F2EA] px-3.5 py-2.5 text-[15px] font-semibold text-[#1F5E3F]">
      {children}
    </p>
  );
}

export function ContentStatusChip({ status }: { status: StatusInfo }) {
  return <span className={`${STATUS_CHIP_CLASS} ${status.className}`}>{status.label}</span>;
}

/** Status line under an editor title: chip, note and who changed it last. */
export function StatusLine({
  status,
  updatedAt,
  updatedBy,
  publishedAt,
}: {
  status: StatusInfo;
  updatedAt?: Date | null;
  updatedBy?: string | null;
  publishedAt?: Date | null;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex flex-wrap items-center gap-2">
        <ContentStatusChip status={status} />
        {status.note ? <span className="text-[14px] text-ink-2">{status.note}</span> : null}
      </span>
      {updatedAt ? (
        <span className="text-[13px] text-muted">
          Последна промяна: {formatNumericDateTime(updatedAt)}
          {updatedBy ? <> · <span className="break-all">{updatedBy}</span></> : null}
          {publishedAt ? <> · публикувано {formatNumericDateTime(publishedAt)}</> : null}
        </span>
      ) : null}
    </div>
  );
}
