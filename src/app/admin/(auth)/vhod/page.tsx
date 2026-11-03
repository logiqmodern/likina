import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { LoginForm } from "@/components/admin/auth-forms";
import { panelClass } from "@/components/admin/ui";
import { pendingMfaStep } from "@/server/admin/access";
import { getCurrentAdmin } from "@/server/admin/auth";
import { serverEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Вход" };

export default function LoginPage() {
  return (
    <section aria-labelledby="login-title" className={`${panelClass} flex flex-col gap-5 p-6 sm:p-8`}>
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
        <ConfigWarning />
      </Suspense>
      <div className="flex flex-col gap-1">
        <h1 id="login-title" className="text-2xl font-extrabold tracking-[-0.01em]">
          Вход в админ панела
        </h1>
        <p className="text-[15px] text-muted">Само за екипа на студиото.</p>
      </div>
      <LoginForm />
    </section>
  );
}

/** Someone who already has a session goes straight on (to the panel or the pending 2FA step). */
async function RedirectIfSignedIn() {
  const ctx = await getCurrentAdmin();
  if (ctx) redirect(pendingMfaStep(ctx) ?? "/admin");
  return null;
}

/** SESSION_SECRET missing or invalid: 2FA cannot work — say so instead of failing at login. */
async function ConfigWarning() {
  await connection();
  if (serverEnv().SESSION_SECRET) return null;
  return (
    <p role="alert" className="rounded-xl border border-warning-border bg-warning-bg px-3.5 py-2.5 text-[15px] font-semibold text-warning-text">
      Админът не е настроен: липсва или е невалиден SESSION_SECRET (поне 32 знака). Виж docs/RUNBOOK.md.
    </p>
  );
}
