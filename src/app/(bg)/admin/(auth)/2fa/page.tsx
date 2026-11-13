import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { MfaForm } from "@/components/admin/auth-forms";
import { LogoutButton } from "@/components/admin/nav";
import { PanelSkeleton, panelClass } from "@/components/admin/ui";
import { ADMIN_PATHS, requireAdminSession } from "@/server/admin/auth";

export const metadata: Metadata = { title: "Двуфакторен вход" };

export default function MfaPage() {
  return (
    <Suspense fallback={<PanelSkeleton rows={4} />}>
      <MfaStep />
    </Suspense>
  );
}

async function MfaStep() {
  const ctx = await requireAdminSession({ allowMfaPending: true });
  if (!ctx.user.totpEnabled) redirect(ADMIN_PATHS.mfaSetup);
  if (ctx.mfaVerified) redirect(ADMIN_PATHS.home);

  return (
    <section aria-labelledby="mfa-title" className={`${panelClass} flex flex-col gap-5 p-6 sm:p-8`}>
      <div className="flex flex-col gap-1">
        <h1 id="mfa-title" className="text-2xl font-extrabold tracking-[-0.01em]">
          Код за вход
        </h1>
        <p className="text-[15px] text-ink-2">
          Отвори приложението за удостоверяване на телефона си и въведи кода за „Likina“.
        </p>
      </div>
      <MfaForm />
      <div className="flex items-center justify-between gap-3 border-t border-[#E9E3DA] pt-4 text-sm text-muted">
        <span>
          Влизаш като <strong className="text-ink">{ctx.user.email}</strong>
        </span>
        <LogoutButton />
      </div>
    </section>
  );
}
