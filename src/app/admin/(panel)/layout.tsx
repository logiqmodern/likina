import Link from "next/link";
import { Suspense } from "react";
import { AdminRoleProvider } from "@/components/admin/role-context";
import { getDb } from "@/db/client";
import { LogoutButton, MobileTabBar, SidebarNav, TopbarTitle } from "@/components/admin/nav";
import { sectionsForRole } from "@/lib/admin-nav";
import { requireAdmin, ROLE_LABELS } from "@/server/admin/auth";
import { countNewInquiries } from "@/server/admin/inquiries";

/*
 * Admin shell: sidebar on desktop, top bar + bottom tabs on phones.
 * The layout checks the session for the chrome (name, role-based nav), but a
 * layout does not guard its pages — each page calls requireAdmin() itself.
 */
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <PanelShell>{children}</PanelShell>
    </Suspense>
  );
}

async function PanelShell({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const inquiryCount = await countNewInquiries(getDb());
  const keys = sectionsForRole(user.role).map((s) => s.key);
  const roleLabel = ROLE_LABELS[user.role];

  return (
    <div className="flex min-h-dvh flex-1">
      <a
        href="#admin-main"
        className="sr-only-focusable absolute left-2 top-2 z-50 rounded-xl bg-ink px-4 py-2 font-bold text-white"
      >
        Към съдържанието
      </a>

      <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col gap-[18px] overflow-y-auto border-r border-[#ECE6EA] bg-white px-3.5 py-4 lg:flex">
        <ShellBrand />
        <SidebarNav keys={keys} inquiryCount={inquiryCount} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-[#ECE6EA] bg-white px-4 lg:h-16 lg:px-7">
          <span className="lg:hidden">
            <BrandMark />
          </span>
          <TopbarTitle className="min-w-0 flex-1 truncate text-lg font-extrabold tracking-[-0.01em] lg:text-xl" />
          <div className="hidden items-center gap-3 lg:flex">
            <span className="flex flex-col items-end leading-tight">
              <span className="text-sm font-bold">{user.name}</span>
              <span className="text-xs text-muted">{roleLabel}</span>
            </span>
            <LogoutButton />
          </div>
        </header>

        <main id="admin-main" tabIndex={-1} className="flex flex-1 flex-col gap-5 px-3 pb-28 pt-4 sm:px-5 lg:px-7 lg:pb-8 lg:pt-6">
          <AdminRoleProvider role={user.role}>{children}</AdminRoleProvider>
        </main>
      </div>

      <MobileTabBar keys={keys} inquiryCount={inquiryCount} userName={user.name} roleLabel={roleLabel} />
    </div>
  );
}

function BrandMark() {
  return (
    <Link href="/admin" aria-label="Админ табло" className="flex h-11 items-center">
      <svg width="34" height="22" viewBox="0 0 34 22" aria-hidden="true" focusable="false">
        <path d="M7 1C7 6 9 9 13 11C9 13 7 16 7 21C7 16 5 13 1 11C5 9 7 6 7 1Z" fill="#E8A1D1" />
        <path d="M17 1C17 6 19 9 23 11C19 13 17 16 17 21C17 16 15 13 11 11C15 9 17 6 17 1Z" fill="#D987BF" />
        <path d="M27 1C27 6 29 9 33 11C29 13 27 16 27 21C27 16 25 13 21 11C25 9 27 6 27 1Z" fill="#E8A1D1" />
      </svg>
    </Link>
  );
}

function ShellBrand() {
  return (
    <div className="flex h-10 items-center justify-between gap-2 px-1.5">
      <Link href="/admin" aria-label="Лежиш и Отслабваш — админ табло" className="flex items-center gap-2 text-ink no-underline">
        <svg width="34" height="22" viewBox="0 0 34 22" aria-hidden="true" focusable="false">
          <path d="M7 1C7 6 9 9 13 11C9 13 7 16 7 21C7 16 5 13 1 11C5 9 7 6 7 1Z" fill="#E8A1D1" />
          <path d="M17 1C17 6 19 9 23 11C19 13 17 16 17 21C17 16 15 13 11 11C15 9 17 6 17 1Z" fill="#D987BF" />
          <path d="M27 1C27 6 29 9 33 11C29 13 27 16 27 21C27 16 25 13 21 11C25 9 27 6 27 1Z" fill="#E8A1D1" />
        </svg>
        <span className="flex flex-col leading-none">
          <span className="text-[11px] font-semibold tracking-[0.04em]">Лежиш и</span>
          <span className="text-[15px] font-extrabold tracking-[0.07em]">ОТСЛАБВАШ</span>
        </span>
      </Link>
      <span className="rounded-md bg-ink px-[7px] py-[3px] text-[11px] font-extrabold uppercase tracking-[0.08em] text-white">
        Админ
      </span>
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh flex-1" aria-busy="true">
      <aside className="hidden w-[248px] shrink-0 border-r border-[#ECE6EA] bg-white px-3.5 py-4 lg:block">
        <ShellBrand />
      </aside>
      <div className="flex flex-1 flex-col">
        <div className="h-14 border-b border-[#ECE6EA] bg-white lg:h-16" />
        <p className="sr-only" role="status">
          Зареждане…
        </p>
      </div>
    </div>
  );
}
