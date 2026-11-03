import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { BootstrapForm } from "@/components/admin/auth-forms";
import { PanelSkeleton, panelClass } from "@/components/admin/ui";
import { serverEnv } from "@/lib/env";
import { isBootstrapOpen } from "@/server/admin/login";

export const metadata: Metadata = { title: "Първоначална настройка" };

/**
 * First-user bootstrap. Exists only while `admin_users` is empty AND
 * ADMIN_SETUP_TOKEN is configured (the proxy also 404s it without the token).
 */
export default function BootstrapPage() {
  return (
    <Suspense fallback={<PanelSkeleton rows={6} />}>
      <Bootstrap />
    </Suspense>
  );
}

async function Bootstrap() {
  await connection();
  if (!(await isBootstrapOpen(getDb(), serverEnv().ADMIN_SETUP_TOKEN))) notFound();

  return (
    <section aria-labelledby="bootstrap-title" className={`${panelClass} flex flex-col gap-5 p-6 sm:p-8`}>
      <div className="flex flex-col gap-1">
        <h1 id="bootstrap-title" className="text-2xl font-extrabold tracking-[-0.01em]">
          Първи профил
        </h1>
        <p className="text-[15px] text-ink-2">
          Създава профил на разработчика. След това задължително се настройва двуфакторен вход. Страницата изчезва,
          щом има поне един профил.
        </p>
      </div>
      <BootstrapForm />
    </section>
  );
}
