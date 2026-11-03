"use client";

import { type ReactNode, useState, useTransition } from "react";
import { resetTotpAction, revokeInviteAction, setUserActiveAction } from "@/app/admin/_actions/users";
import { Button } from "@/components/admin/forms";
import type { ActionResult } from "@/server/admin/action-result";

/** One action button with an inline „Да / Не“ confirmation and an aria-live result. */
function ConfirmAction({
  label,
  question,
  yes,
  variant = "secondary",
  confirmVariant = "dark",
  run,
}: {
  label: string;
  question: ReactNode;
  yes: string;
  variant?: "secondary" | "danger" | "ghost";
  confirmVariant?: "dark" | "danger";
  run: () => Promise<ActionResult>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      {confirming ? (
        <div className="flex flex-col gap-2 rounded-xl bg-[#F7F4EF] p-3">
          <p className="text-[15px] font-semibold">{question}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={confirmVariant}
              pending={pending}
              pendingText="Моля, изчакай…"
              onClick={() =>
                startTransition(async () => {
                  const r = await run();
                  setResult(r);
                  setConfirming(false);
                })
              }
            >
              {yes}
            </Button>
            <Button variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
              Не
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button
            variant={variant}
            className="px-4 text-[15px]"
            onClick={() => {
              setResult(null);
              setConfirming(true);
            }}
          >
            {label}
          </Button>
        </div>
      )}
      <p aria-live="polite" role="status" className={`text-[14px] font-semibold empty:hidden ${result?.ok ? "text-[#1F5E3F]" : "text-error"}`}>
        {result?.message}
      </p>
    </div>
  );
}

export function UserActions({
  userId,
  name,
  isActive,
  canManage,
  canResetTotp,
}: {
  userId: string;
  name: string;
  isActive: boolean;
  canManage: boolean;
  canResetTotp: boolean;
}) {
  if (!canManage && !canResetTotp) return null;
  return (
    <div className="flex flex-wrap items-start gap-2">
      {canManage ? (
        isActive ? (
          <ConfirmAction
            label="Деактивирай"
            variant="danger"
            confirmVariant="danger"
            question={`Да деактивирам ли профила на ${name}? Ще бъде изведен(а) от всички устройства и няма да може да влиза.`}
            yes="Да, деактивирай"
            run={() => setUserActiveAction(userId, false)}
          />
        ) : (
          <ConfirmAction
            label="Активирай"
            question={`Да активирам ли отново профила на ${name}?`}
            yes="Да, активирай"
            run={() => setUserActiveAction(userId, true)}
          />
        )
      ) : null}
      {canResetTotp ? (
        <ConfirmAction
          label="Нулирай 2FA"
          question={`Да нулирам ли двуфакторния вход на ${name}? Ще бъде изведен(а) от всички устройства и при следващия вход ще го настрои отново с телефона си.`}
          yes="Да, нулирай"
          run={() => resetTotpAction(userId)}
        />
      ) : null}
    </div>
  );
}

export function RevokeInvite({ inviteId, email }: { inviteId: string; email: string }) {
  return (
    <ConfirmAction
      label="Отмени поканата"
      variant="ghost"
      question={`Да отменя ли поканата за ${email}? Линкът спира да работи веднага.`}
      yes="Да, отмени"
      confirmVariant="danger"
      run={() => revokeInviteAction(inviteId)}
    />
  );
}
