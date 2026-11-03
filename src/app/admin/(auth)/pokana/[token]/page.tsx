import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PanelSkeleton, panelClass } from "@/components/admin/ui";
import { AcceptInviteForm } from "@/components/admin/users/accept-invite-form";
import { getDb } from "@/db/client";
import { ROLE_LABELS } from "@/server/admin/auth";
import { MFA_REQUIRED_ROLES } from "@/server/admin/access";
import { findInvite } from "@/server/admin/users";

export const metadata: Metadata = {
  title: "Покана",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

type Props = { params: Promise<{ token: string }> };

/** Invitation link (§10.1): no session needed; the invitee chooses a password. */
export default function InvitePage(props: Props) {
  return (
    <Suspense fallback={<PanelSkeleton rows={5} />}>
      <Invite {...props} />
    </Suspense>
  );
}

async function Invite({ params }: Props) {
  await connection();
  const { token } = await params;
  const invite = await findInvite(getDb(), token, new Date());

  if (!invite) {
    return (
      <section aria-labelledby="invite-title" className={`${panelClass} flex flex-col gap-4 p-6 sm:p-8`}>
        <h1 id="invite-title" className="text-2xl font-extrabold tracking-[-0.01em]">
          Поканата не е валидна
        </h1>
        <p className="text-[15px] text-ink-2">
          Линкът е използван, изтекъл е (важи 72 часа) или поканата е отменена. Помоли човека, който те е поканил, за нова покана.
        </p>
        <Link href="/admin/vhod" className="btn btn-secondary w-full">
          Към входа
        </Link>
      </section>
    );
  }

  return (
    <section aria-labelledby="invite-title" className={`${panelClass} flex flex-col gap-5 p-6 sm:p-8`}>
      <div className="flex flex-col gap-1">
        <h1 id="invite-title" className="text-2xl font-extrabold tracking-[-0.01em]">
          Добре дошъл(а), {invite.name}
        </h1>
        <p className="text-[15px] text-ink-2">Избери парола за своя профил в админ панела. Никой друг не я знае.</p>
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 rounded-xl bg-[#F7F5F6] px-4 py-3 text-[15px]">
        <dt className="font-semibold text-muted">Имейл</dt>
        <dd className="break-all font-bold">{invite.email}</dd>
        <dt className="font-semibold text-muted">Роля</dt>
        <dd className="font-bold">{ROLE_LABELS[invite.role]}</dd>
      </dl>
      {MFA_REQUIRED_ROLES.includes(invite.role) ? (
        <p className="text-[14px] text-ink-2">
          След първия вход ще настроиш двуфакторен вход с приложение на телефона (напр. Google Authenticator) — задължително е за
          тази роля.
        </p>
      ) : null}
      <AcceptInviteForm token={token} email={invite.email} />
    </section>
  );
}
