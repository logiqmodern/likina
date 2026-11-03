import Link from "next/link";
import type { ReactNode } from "react";
import { formatEur } from "@/domain/pricing";
import { IconCamera } from "./icons";

/**
 * Visible placeholder for anything the client still has to confirm (§0 rule 2).
 * Hidden on the site since the client review (13.10.2026, Tony's call); the
 * open items stay in docs/OPEN-QUESTIONS.md and the admin flags. Set
 * NEXT_PUBLIC_SHOW_TODO=1 at build time to show them again.
 */
export const SHOW_TODO = process.env.NEXT_PUBLIC_SHOW_TODO === "1";

export function TodoChip({ children }: { children: ReactNode }) {
  if (!SHOW_TODO) return null;
  return <span className="todo-chip">TODO-CLIENT: {children}</span>;
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`eyebrow ${className}`}>{children}</p>;
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
  id,
  className = "",
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  id?: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2 id={id} className="h2">
        {title}
      </h2>
      {lead ? <p className="lead-lg text-ink-2">{lead}</p> : null}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "dark" | "on-dark";

export function ButtonLink({
  href,
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...rest
}: {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: "md" | "lg";
  className?: string;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  const cls = `btn btn-${variant} ${size === "lg" ? "btn-lg" : ""} ${className}`;
  const external = /^(https?:|tel:|mailto:)/.test(href);
  if (external) {
    return (
      <a href={href} className={cls} {...rest}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls} {...rest}>
      {children}
    </Link>
  );
}

/** Real photos are pending (OPEN-QUESTIONS A3) — a calm, brand-coloured placeholder. */
export function PhotoPlaceholder({
  label,
  todo = "реална снимка",
  className = "",
  decorated = false,
}: {
  label: string;
  todo?: string | null;
  className?: string;
  decorated?: boolean;
}) {
  return (
    <div
      role="img"
      aria-label={`${label} (предстои)`}
      className={`relative flex flex-col items-center justify-center gap-2 overflow-hidden rounded-[20px] bg-blush-100 p-4 text-center ${className}`}
    >
      {decorated ? (
        <>
          <span aria-hidden="true" className="absolute -right-24 -top-28 h-64 w-64 rounded-full border border-blush-300" />
          <span aria-hidden="true" className="absolute -bottom-20 -left-16 h-44 w-44 rounded-full border border-blush-300" />
        </>
      ) : null}
      <IconCamera size={28} className="text-muted" />
      <span className="text-sm font-semibold text-muted">{label}</span>
      {todo ? <TodoChip>{todo}</TodoChip> : null}
    </div>
  );
}

/** Final price, optional struck "usual" price with screen-reader text, and label. */
export function Price({
  finalCents,
  baseCents,
  hasDiscount,
  label,
  size = "lg",
}: {
  finalCents: number;
  baseCents: number;
  hasDiscount: boolean;
  label: string | null;
  size?: "md" | "lg";
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
      <span className={`${size === "lg" ? "text-[40px]" : "text-[22px]"} font-extrabold leading-none tracking-tight`}>
        <span className="sr-only">Цена: </span>
        {formatEur(finalCents)}
      </span>
      {hasDiscount ? (
        <>
          <s className="text-muted">
            <span className="sr-only">Обичайна цена: </span>
            {formatEur(baseCents)}
          </s>
          {label ? (
            <span className="rounded-md bg-ink px-1.5 py-0.5 text-[13px] font-extrabold text-white">{label}</span>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** Pulse placeholder with a fixed height so streamed content does not shift the layout. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-[20px] bg-blush-50 ${className}`} />;
}
