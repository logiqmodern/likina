import { Logo } from "@/components/site/logo";

/** Login, 2FA and first-user setup: a plain centred card, no admin navigation. */
export default function AdminAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center px-4 py-10 sm:justify-center">
      <div className="flex w-full max-w-[440px] flex-col gap-6">
        <div className="flex items-center justify-center gap-3">
          <Logo />
          <span className="rounded-md bg-ink px-[7px] py-[3px] text-[11px] font-extrabold uppercase tracking-[0.08em] text-white">
            Админ
          </span>
        </div>
        {children}
      </div>
    </main>
  );
}
