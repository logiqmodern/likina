import type { ReactNode } from "react";

/** Admin surfaces (approved CMS mockups): app bg #F7F4EF, white panels, radius 16, border #E9E3DA. */

export const panelClass =
  "rounded-2xl border border-[#E9E3DA] bg-white shadow-[0_1px_2px_rgba(42,31,26,0.04),0_4px_14px_rgba(42,31,26,0.04)]";

export function Panel({
  children,
  className = "",
  ...rest
}: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={`${panelClass} ${className}`} {...rest}>
      {children}
    </section>
  );
}

const CHIP = "inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold";

/** Status is always text + colour, never colour alone (§13). */
export function StatusChip({ label, className = "bg-[#EEE9E2] text-muted", suffix }: { label: string; className?: string; suffix?: string }) {
  return (
    <span className={`${CHIP} ${className}`}>
      {label}
      {suffix ? ` · ${suffix}` : null}
    </span>
  );
}

/** Thin progress bar with an accessible label ("5 от 12"). */
export function ProgressBar({ value, max, label, className = "" }: { value: number; max: number; label: string; className?: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, Math.round((value / max) * 100))) : 0;
  return (
    <span role="img" aria-label={label} className={`block h-1.5 overflow-hidden rounded-full bg-[#F1ECE4] ${className}`}>
      <span className="block h-full rounded-full bg-accent-600" style={{ width: `${pct}%` }} />
    </span>
  );
}

export function PanelSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className={`${panelClass} flex flex-col gap-3 p-5`} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="block h-5 animate-pulse rounded-md bg-[#F1ECE4]" style={{ width: `${90 - i * 15}%` }} />
      ))}
    </div>
  );
}
