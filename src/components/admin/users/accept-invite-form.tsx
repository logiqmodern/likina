"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { type AcceptInviteState, acceptInviteAction } from "@/app/admin/_actions/users";

const INITIAL: AcceptInviteState = { status: "idle" };

function PasswordField({
  name,
  label,
  help,
  error,
  autoFocus,
}: {
  name: string;
  label: string;
  help?: string;
  error?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  const describedBy = [help ? `${id}-help` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="password"
        autoComplete="new-password"
        minLength={12}
        required
        autoFocus={autoFocus}
        className="field-input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {help ? (
        <p id={`${id}-help`} className="field-help">
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** The invitee chooses a password; on success the account exists and they sign in normally. */
export function AcceptInviteForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState(acceptInviteAction, INITIAL);

  if (state.status === "done") {
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="rounded-xl border border-success/30 bg-[#E3F2EA] px-3.5 py-2.5 text-[15px] font-semibold text-[#1F5E3F]">
          Профилът е създаден. Влез с имейла и новата си парола.
        </p>
        <Link href="/admin/vhod" className="btn btn-primary w-full">
          Към входа
        </Link>
      </div>
    );
  }

  if (state.status === "invalid") {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="rounded-xl border border-error/30 bg-[#FDECEA] px-3.5 py-2.5 text-[15px] font-semibold text-error">
          Поканата вече не е валидна — използвана е, изтекла е или е отменена. Поискай нова покана.
        </p>
        <Link href="/admin/vhod" className="btn btn-secondary w-full">
          Към входа
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <div aria-live="assertive" role="alert" className="empty:hidden">
        {state.status === "error" && state.message ? (
          <p className="rounded-xl border border-error/30 bg-[#FDECEA] px-3.5 py-2.5 text-[15px] font-semibold text-error">{state.message}</p>
        ) : null}
      </div>
      <input type="hidden" name="token" value={token} />
      {/* lets password managers save the login together with the new password */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <PasswordField
        name="password"
        label="Нова парола"
        help="Поне 12 знака. Най-добре дълга фраза от няколко думи."
        error={state.fieldErrors?.password}
        autoFocus
      />
      <PasswordField name="passwordRepeat" label="Повтори паролата" error={state.fieldErrors?.passwordRepeat} />
      <button type="submit" className="btn btn-primary w-full" disabled={pending} aria-disabled={pending}>
        {pending ? "Създаване…" : "Създай профил"}
      </button>
    </form>
  );
}
