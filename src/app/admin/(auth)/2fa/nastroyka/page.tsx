import type { Metadata } from "next";
import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { Suspense } from "react";
import { getDb } from "@/db/client";
import { TotpSetupForm } from "@/components/admin/auth-forms";
import { LogoutButton } from "@/components/admin/nav";
import { PanelSkeleton, panelClass } from "@/components/admin/ui";
import { MFA_REQUIRED_ROLES } from "@/server/admin/access";
import { ADMIN_PATHS, requireAdminSession } from "@/server/admin/auth";
import { getOrCreatePendingTotp } from "@/server/admin/login";
import { formatSecretForDisplay, totpKeyFromEnv } from "@/server/admin/totp";

export const metadata: Metadata = { title: "Настройка на двуфакторен вход" };

export default function TotpSetupPage() {
  return (
    <Suspense fallback={<PanelSkeleton rows={6} />}>
      <TotpSetup />
    </Suspense>
  );
}

async function TotpSetup() {
  const ctx = await requireAdminSession({ allowMfaPending: true });
  // Already enrolled: never show a new secret to a session that only knows the password.
  if (ctx.user.totpEnabled) redirect(ctx.mfaVerified ? ADMIN_PATHS.home : ADMIN_PATHS.mfa);

  let key: Buffer;
  try {
    key = totpKeyFromEnv();
  } catch (error) {
    console.error("admin 2fa setup: SESSION_SECRET missing", error);
    return (
      <section className={`${panelClass} flex flex-col gap-3 p-6 sm:p-8`}>
        <h1 className="text-2xl font-extrabold">Двуфакторният вход не е настроен</h1>
        <p className="text-[15px] text-ink-2">
          На сървъра липсва SESSION_SECRET. Разработчикът трябва да го добави в .env (виж RUNBOOK → Админ).
        </p>
        <LogoutButton />
      </section>
    );
  }

  const pending = await getOrCreatePendingTotp(getDb(), ctx.user, key);
  if (!pending) redirect(ADMIN_PATHS.mfa);

  // Generated on the server from our own URI: the SVG contains only path data.
  const qrSvg = await QRCode.toString(pending.uri, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#2B1A26", light: "#FFFFFF" },
  });
  const required = MFA_REQUIRED_ROLES.includes(ctx.user.role);

  return (
    <section aria-labelledby="setup-title" className={`${panelClass} flex flex-col gap-5 p-6 sm:p-8`}>
      <div className="flex flex-col gap-1">
        <h1 id="setup-title" className="text-2xl font-extrabold tracking-[-0.01em]">
          Двуфакторен вход
        </h1>
        <p className="text-[15px] text-ink-2">
          {required
            ? "За твоя профил е задължителен. Отнема около минута."
            : "По избор, но силно препоръчителен — пази данните на клиентите."}
        </p>
      </div>

      <ol className="flex list-decimal flex-col gap-4 pl-5 text-[15px] marker:font-extrabold">
        <li>
          Инсталирай приложение за удостоверяване на телефона си (например Google Authenticator, Microsoft
          Authenticator или 1Password).
        </li>
        <li className="flex flex-col gap-3">
          <span>Сканирай QR кода с приложението.</span>
          <div
            role="img"
            aria-label="QR код за добавяне на профила в приложението за удостоверяване"
            className="size-48 self-center rounded-xl border border-[#ECE6EA] bg-white p-2 [&>svg]:size-full"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <span className="text-sm text-muted">
            На този телефон ли си?{" "}
            <a href={pending.uri} className="link">
              Отвори директно в приложението
            </a>{" "}
            или въведи ключа ръчно:
          </span>
          <code
            aria-label="Ключ за ръчно въвеждане"
            className="select-all break-all rounded-xl bg-[#F7F5F6] px-3 py-2 text-center font-mono text-[15px] font-bold tracking-wider"
          >
            {formatSecretForDisplay(pending.secret)}
          </code>
        </li>
        <li>Въведи 6-цифрения код, който показва приложението.</li>
      </ol>

      <TotpSetupForm />

      <div className="flex items-center justify-between gap-3 border-t border-[#ECE6EA] pt-4 text-sm text-muted">
        <span>
          Профил: <strong className="text-ink">{ctx.user.email}</strong>
        </span>
        <LogoutButton />
      </div>
    </section>
  );
}
