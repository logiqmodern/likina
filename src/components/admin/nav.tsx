"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { logoutAction } from "@/app/admin/_actions/auth";
import {
  ADMIN_SECTIONS,
  type AdminSection,
  type AdminSectionKey,
  activeSection,
  MOBILE_TAB_KEYS,
} from "@/lib/admin-nav";
import { IconClose, IconLogout, IconMore, IconUser, SECTION_ICONS } from "./icons";

/*
 * Admin navigation (client: needs the current path for aria-current).
 * Which sections a user may see is decided on the server and passed in;
 * the pages themselves re-check access with requireAdmin().
 */

function pick(keys: readonly AdminSectionKey[]): AdminSection[] {
  return ADMIN_SECTIONS.filter((s) => keys.includes(s.key));
}

function Badge({ count, small = false }: { count: number; small?: boolean }) {
  if (count <= 0) return null;
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-ink font-extrabold tabular-nums text-white ${
        small ? "h-[18px] min-w-[18px] px-[5px] text-[11px]" : "ml-auto h-[22px] min-w-[22px] px-1.5 text-xs"
      }`}
    >
      <span className="sr-only">Нови: </span>
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function SidebarNav({ keys, inquiryCount }: { keys: AdminSectionKey[]; inquiryCount: number }) {
  const pathname = usePathname();
  const current = activeSection(pathname)?.key;
  return (
    <nav aria-label="Админ навигация">
      <ul className="flex flex-col gap-0.5">
        {pick(keys).map((s) => {
          const Icon = SECTION_ICONS[s.key];
          const isCurrent = s.key === current;
          return (
            <li key={s.key}>
              <Link
                href={s.href}
                aria-current={isCurrent ? "page" : undefined}
                className={`relative flex h-11 items-center gap-3 rounded-[10px] px-3 text-[15px] no-underline transition-colors ${
                  isCurrent ? "bg-tint-100 font-bold text-ink" : "font-semibold text-ink-2 hover:bg-[#F7F4EF]"
                }`}
              >
                {isCurrent ? (
                  <span aria-hidden="true" className="absolute bottom-2 left-0 top-2 w-[3px] rounded-[3px] bg-accent" />
                ) : null}
                <Icon />
                {s.label}
                {s.key === "zapitvaniya" ? <Badge count={inquiryCount} /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Page title in the top bar, derived from the open section. */
export function TopbarTitle({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  return <h1 className={className}>{activeSection(pathname)?.label ?? "Админ"}</h1>;
}

export function MobileTabBar({
  keys,
  inquiryCount,
  userName,
  roleLabel,
}: {
  keys: AdminSectionKey[];
  inquiryCount: number;
  userName: string;
  roleLabel: string;
}) {
  const pathname = usePathname();
  const current = activeSection(pathname)?.key;
  const dialogRef = useRef<HTMLDialogElement>(null);

  const tabs = pick(MOBILE_TAB_KEYS.filter((k) => keys.includes(k)));
  const more = pick(keys.filter((k) => !MOBILE_TAB_KEYS.includes(k)));
  const moreIsCurrent = more.some((s) => s.key === current);
  const moreBadge = more.some((s) => s.key === "zapitvaniya") ? inquiryCount : 0;

  // Close the sheet after navigating.
  useEffect(() => {
    dialogRef.current?.close();
  }, [pathname]);

  const tabClass = (isCurrent: boolean) =>
    `relative flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl text-xs no-underline ${
      isCurrent ? "bg-tint-100 font-extrabold text-ink" : "font-bold text-muted"
    }`;

  return (
    <>
      <nav
        aria-label="Основна навигация"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 gap-1 border-t border-[#E9E3DA] bg-white px-2 pt-1.5 shadow-[0_-6px_20px_rgba(42,31,26,0.06)] lg:hidden"
        style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}
      >
        {tabs.map((s) => {
          const Icon = SECTION_ICONS[s.key];
          const isCurrent = s.key === current;
          return (
            <Link key={s.key} href={s.href} aria-current={isCurrent ? "page" : undefined} className={tabClass(isCurrent)}>
              <Icon size={22} />
              {s.label}
            </Link>
          );
        })}
        <button
          type="button"
          className={tabClass(moreIsCurrent)}
          aria-haspopup="dialog"
          aria-controls="admin-more-menu"
          onClick={() => dialogRef.current?.showModal()}
        >
          <IconMore size={22} />
          Още
          {moreBadge > 0 ? (
            <span className="absolute left-1/2 top-1.5 ml-2">
              <Badge count={moreBadge} small />
            </span>
          ) : null}
        </button>
      </nav>

      <dialog
        ref={dialogRef}
        id="admin-more-menu"
        aria-labelledby="admin-more-title"
        className="m-0 mt-auto max-h-[85dvh] w-full max-w-none rounded-t-[20px] bg-white p-0 text-ink backdrop:bg-ink/40 lg:hidden"
        onClick={(e) => {
          // Click on the backdrop (the dialog element itself) closes the sheet.
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
      >
        <div className="flex items-center justify-between gap-2 border-b border-[#E9E3DA] px-4 py-2">
          <h2 id="admin-more-title" className="text-[17px] font-extrabold">
            Още
          </h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="flex size-11 items-center justify-center rounded-xl text-ink"
          >
            <IconClose size={22} />
            <span className="sr-only">Затвори</span>
          </button>
        </div>
        <ul className="flex flex-col gap-0.5 p-2">
          {more.map((s) => {
            const Icon = SECTION_ICONS[s.key];
            const isCurrent = s.key === current;
            return (
              <li key={s.key}>
                <Link
                  href={s.href}
                  aria-current={isCurrent ? "page" : undefined}
                  onClick={() => dialogRef.current?.close()}
                  className={`flex min-h-12 items-center gap-3 rounded-xl px-3 text-base no-underline ${
                    isCurrent ? "bg-tint-100 font-bold" : "font-semibold text-ink-2"
                  }`}
                >
                  <Icon size={22} />
                  {s.label}
                  {s.key === "zapitvaniya" ? <Badge count={inquiryCount} /> : null}
                </Link>
              </li>
            );
          })}
        </ul>
        <div
          className="flex items-center gap-3 border-t border-[#E9E3DA] px-4 pt-3"
          style={{ paddingBottom: "max(16px, env(safe-area-inset-bottom))" }}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-tint-200">
            <IconUser size={18} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate text-sm font-bold">{userName}</span>
            <span className="text-xs text-muted">{roleLabel}</span>
          </span>
          <LogoutButton />
        </div>
      </dialog>
    </>
  );
}

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#E0D7CB] bg-white text-sm font-bold text-ink hover:bg-[#F7F4EF] ${
          compact ? "w-11" : "px-3"
        }`}
      >
        <IconLogout />
        {compact ? <span className="sr-only">Изход</span> : "Изход"}
      </button>
    </form>
  );
}
