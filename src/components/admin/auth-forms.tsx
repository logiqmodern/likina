"use client";

import { useActionState, useId } from "react";
import {
  type AuthFormState,
  bootstrapAction,
  confirmTotpSetupAction,
  loginAction,
  verifyMfaAction,
} from "@/app/(bg)/admin/_actions/auth";

const INITIAL: AuthFormState = { status: "idle" };

function FormMessage({ state }: { state: AuthFormState }) {
  // Always rendered so screen readers announce changes (aria-live).
  return (
    <div aria-live="assertive" role="alert" className="empty:hidden">
      {state.status === "error" && state.message ? (
        <p className="rounded-xl border border-error/30 bg-[#FDECEA] px-3.5 py-2.5 text-[15px] font-semibold text-error">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

function Field({
  name,
  label,
  state,
  help,
  ...input
}: {
  name: string;
  label: string;
  state: AuthFormState;
  help?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const error = state.fieldErrors?.[name];
  const describedBy = [help ? `${id}-help` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        name={name}
        className="field-input"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        defaultValue={state.values?.[name]}
        {...input}
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

function Submit({ pending, children, pendingText }: { pending: boolean; children: string; pendingText: string }) {
  return (
    <button type="submit" className="btn btn-primary w-full" disabled={pending} aria-disabled={pending}>
      {pending ? pendingText : children}
    </button>
  );
}

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, INITIAL);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <Field
        name="email"
        label="Имейл"
        type="email"
        autoComplete="username"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        state={state}
      />
      <Field name="password" label="Парола" type="password" autoComplete="current-password" required state={state} />
      <Submit pending={pending} pendingText="Влизане…">
        Вход
      </Submit>
    </form>
  );
}

function CodeField({ state }: { state: AuthFormState }) {
  return (
    <Field
      name="code"
      label="6-цифрен код"
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9 ]*"
      maxLength={7}
      required
      state={state}
      className="field-input text-center text-2xl font-extrabold tracking-[0.3em] tabular-nums"
      help="Кодът се сменя на всеки 30 секунди."
    />
  );
}

export function MfaForm() {
  const [state, action, pending] = useActionState(verifyMfaAction, INITIAL);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <CodeField state={state} />
      <Submit pending={pending} pendingText="Проверка…">
        Потвърди
      </Submit>
    </form>
  );
}

export function TotpSetupForm() {
  const [state, action, pending] = useActionState(confirmTotpSetupAction, INITIAL);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <CodeField state={state} />
      <Submit pending={pending} pendingText="Проверка…">
        Включи двуфакторния вход
      </Submit>
    </form>
  );
}

export function BootstrapForm() {
  const [state, action, pending] = useActionState(bootstrapAction, INITIAL);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormMessage state={state} />
      <Field
        name="setupToken"
        label="Код за настройка"
        type="password"
        autoComplete="off"
        required
        state={state}
        help="Стойността на ADMIN_SETUP_TOKEN от .env на сървъра."
      />
      <Field name="name" label="Име" type="text" autoComplete="name" required state={state} />
      <Field
        name="email"
        label="Имейл"
        type="email"
        autoComplete="username"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        state={state}
      />
      <Field
        name="password"
        label="Парола"
        type="password"
        autoComplete="new-password"
        minLength={12}
        required
        state={state}
        help="Поне 12 знака. Най-добре дълга фраза от няколко думи."
      />
      <Submit pending={pending} pendingText="Създаване…">
        Създай профил
      </Submit>
    </form>
  );
}
