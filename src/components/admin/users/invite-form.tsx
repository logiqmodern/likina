"use client";

import { useActionState, useState } from "react";
import { inviteUserAction } from "@/app/(bg)/admin/_actions/users";
import { Button, FormMessage, SelectField, TextField } from "@/components/admin/forms";
import { useSubmitKeepingValues } from "@/components/admin/common/use-keep-values";

const expiryFmt = new Intl.DateTimeFormat("bg-BG", {
  timeZone: "Europe/Sofia",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Invite a user; the one-time link is shown once, right here. */
export function InviteForm({ roles }: { roles: Array<{ value: string; label: string; help: string }> }) {
  const [round, setRound] = useState(0);
  return <InviteFormInner key={round} roles={roles} onAgain={() => setRound((r) => r + 1)} />;
}

function InviteFormInner({
  roles,
  onAgain,
}: {
  roles: Array<{ value: string; label: string; help: string }>;
  onAgain: () => void;
}) {
  const [state, dispatch, pending] = useActionState(inviteUserAction, null);
  const onSubmit = useSubmitKeepingValues(dispatch);
  const [role, setRole] = useState(roles[roles.length - 1]?.value ?? "");
  const [copied, setCopied] = useState<"ok" | "fail" | null>(null);

  if (state?.ok) {
    const { link, expiresAt, name, email } = state.data;
    return (
      <div className="flex flex-col gap-3">
        <p role="status" className="rounded-xl border border-success/30 bg-[#E3F2EA] px-3.5 py-2.5 text-[15px] font-semibold text-[#1F5E3F]">
          Поканата за {name} ({email}) е готова.
        </p>
        <div className="flex flex-col gap-2 rounded-2xl border-[1.5px] border-ink p-3.5">
          <label htmlFor="invite-link" className="field-label">
            Еднократен линк
          </label>
          <input
            id="invite-link"
            readOnly
            value={link}
            className="field-input font-mono text-[14px]"
            onFocus={(e) => e.currentTarget.select()}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="dark"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  setCopied("ok");
                } catch {
                  setCopied("fail");
                }
              }}
            >
              Копирай линка
            </Button>
            <span aria-live="polite" className="text-[14px] font-semibold">
              {copied === "ok" ? "Копирано." : copied === "fail" ? "Не можа да се копира — маркирай линка и го копирай ръчно." : ""}
            </span>
          </div>
          <p className="text-[14px] text-ink-2">
            Изпрати го лично — линкът е еднократен и важи 72 часа (до {expiryFmt.format(new Date(expiresAt))}). След като
            затвориш тази страница, линкът не може да се види отново. Новият потребител сам избира паролата си.
          </p>
        </div>
        <div>
          <Button variant="secondary" onClick={onAgain}>
            Покани друг потребител
          </Button>
        </div>
      </div>
    );
  }

  const selected = roles.find((r) => r.value === role);
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="name" label="Име" state={state} required maxLength={100} autoComplete="off" />
        <TextField
          name="email"
          label="Имейл"
          state={state}
          type="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          autoComplete="off"
          required
        />
        <SelectField
          name="role"
          label="Роля"
          state={state}
          options={roles}
          value={role}
          onChange={(e) => setRole(e.target.value)}
          help={selected?.help}
          className="sm:col-span-2"
        />
      </div>
      <FormMessage state={state} />
      <div>
        <Button type="submit" variant="primary" pending={pending} pendingText="Създаване…" className="w-full sm:w-auto">
          Покани потребител
        </Button>
      </div>
    </form>
  );
}
