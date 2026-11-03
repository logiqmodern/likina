"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";

/*
 * Shared admin form primitives. Usable on a phone in the studio: 44px targets,
 * 16px inputs (no iOS zoom), errors in text next to the field, aria-live
 * messages. Pair with server actions returning ActionResult
 * (src/server/admin/action-result.ts) and React's useActionState.
 */

export interface FormStateLike {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  warnings?: string[];
}

type FieldBase = {
  name: string;
  label: string;
  help?: ReactNode;
  /** error text; or pass `state` and the error for `name` is taken from it */
  error?: string;
  state?: FormStateLike | null;
  className?: string;
};

function useFieldIds(help: unknown, error: unknown) {
  const id = useId();
  const describedBy = [help ? `${id}-help` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return { id, describedBy };
}

function FieldMeta({ id, help, error }: { id: string; help?: ReactNode; error?: string }) {
  return (
    <>
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
    </>
  );
}

export function TextField({
  name,
  label,
  help,
  error,
  state,
  className = "",
  ...input
}: FieldBase & React.InputHTMLAttributes<HTMLInputElement>) {
  const err = error ?? state?.fieldErrors?.[name];
  const { id, describedBy } = useFieldIds(help, err);
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        name={name}
        className="field-input"
        aria-invalid={err ? true : undefined}
        aria-describedby={describedBy}
        {...input}
      />
      <FieldMeta id={id} help={help} error={err} />
    </div>
  );
}

export function TextareaField({
  name,
  label,
  help,
  error,
  state,
  className = "",
  rows = 3,
  ...input
}: FieldBase & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const err = error ?? state?.fieldErrors?.[name];
  const { id, describedBy } = useFieldIds(help, err);
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={rows}
        className="field-input min-h-[88px] resize-y py-2.5"
        aria-invalid={err ? true : undefined}
        aria-describedby={describedBy}
        {...input}
      />
      <FieldMeta id={id} help={help} error={err} />
    </div>
  );
}

export function SelectField({
  name,
  label,
  help,
  error,
  state,
  className = "",
  options,
  ...select
}: FieldBase & {
  options: ReadonlyArray<{ value: string; label: string; disabled?: boolean }>;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const err = error ?? state?.fieldErrors?.[name];
  const { id, describedBy } = useFieldIds(help, err);
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <select
        id={id}
        name={name}
        className="field-input appearance-auto"
        aria-invalid={err ? true : undefined}
        aria-describedby={describedBy}
        {...select}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <FieldMeta id={id} help={help} error={err} />
    </div>
  );
}

export function CheckboxField({
  name,
  label,
  help,
  className = "",
  ...input
}: Omit<FieldBase, "error" | "state"> & React.InputHTMLAttributes<HTMLInputElement>) {
  const { id, describedBy } = useFieldIds(help, null);
  return (
    <div className={className}>
      <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center gap-3 text-[15px] font-semibold">
        <input id={id} name={name} type="checkbox" className="h-5 w-5 shrink-0 accent-ink" aria-describedby={describedBy} {...input} />
        <span>{label}</span>
      </label>
      <FieldMeta id={id} help={help} />
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "dark" | "danger" | "ghost";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "btn btn-primary",
  secondary: "btn btn-secondary",
  dark: "btn btn-dark",
  danger: "btn border-[1.5px] border-error bg-white text-error hover:bg-[#FDECEA]",
  ghost: "btn border-0 bg-transparent text-ink underline-offset-4 hover:underline",
};

export function Button({
  variant = "secondary",
  pending,
  pendingText,
  className = "",
  children,
  type = "button",
  ...rest
}: {
  variant?: ButtonVariant;
  pending?: boolean;
  pendingText?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      {...rest}
      className={`${VARIANTS[variant]} min-h-11 ${className}`}
      disabled={pending || rest.disabled}
      aria-disabled={pending || rest.disabled || undefined}
    >
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

/** Result of the last submit: success or error, announced to screen readers. */
export function FormMessage({ state }: { state: FormStateLike | null | undefined }) {
  const ref = useRef<HTMLDivElement>(null);
  const text = state?.message ?? "";
  // An error under a long form would go unnoticed — scroll it into view.
  useEffect(() => {
    if (text && state?.ok === false) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [text, state?.ok]);
  return (
    <div ref={ref} aria-live="polite" role="status" className="empty:hidden">
      {state?.message ? (
        <p
          className={
            state.ok
              ? "rounded-xl border border-success/30 bg-[#E3F2EA] px-3.5 py-2.5 text-[15px] font-semibold text-[#1F5E3F]"
              : "rounded-xl border border-error/30 bg-[#FDECEA] px-3.5 py-2.5 text-[15px] font-semibold text-error"
          }
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Warnings returned by the server (outside hours, closure, package used up…).
 * Renders the list and a hidden `acceptWarnings` field + an override button
 * that resubmits the same form.
 */
export function WarningsConfirm({ warnings, pending }: { warnings?: string[]; pending?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const key = warnings?.join("|") ?? "";
  // Long forms (sheets on a phone): the warnings render below the fold — bring them into view.
  useEffect(() => {
    if (key) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [key]);
  if (!warnings?.length) return null;
  return (
    <div ref={ref} role="alert" className="rounded-xl border border-warning-border bg-warning-bg px-3.5 py-3 text-warning-text">
      <p className="font-bold">Провери, преди да запишеш:</p>
      <ul className="mt-1 list-disc pl-5 text-[15px]">
        {warnings.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
      <button
        type="submit"
        name="acceptWarnings"
        value="true"
        className="btn btn-dark mt-3 min-h-11"
        disabled={pending}
        aria-disabled={pending || undefined}
      >
        Запиши въпреки това
      </button>
    </div>
  );
}

/**
 * Modal sheet on the native <dialog>: bottom sheet on phones, centred panel
 * on desktop. Focus is trapped and Esc closes it (browser behaviour).
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // Whether the parent still wants it open: a close we make ourselves (e.g. one sheet
  // handing over to another) must not report back as the user closing it.
  const wanted = useRef(open);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    wanted.current = open;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={() => {
        if (wanted.current) onClose(); // Esc
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // click on the backdrop
      }}
      className={`m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-3xl border-0 bg-white p-0 text-ink shadow-2xl backdrop:bg-ink/40 sm:m-auto sm:rounded-3xl ${
        wide ? "sm:max-w-2xl" : "sm:max-w-lg"
      }`}
    >
      {open ? (
        <div className="flex flex-col gap-4 px-4 pb-6 pt-4 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <h2 id={titleId} className="text-lg font-extrabold tracking-[-0.01em]">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-[#F1ECE4]"
              aria-label="Затвори"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}

/**
 * Sub-title row with optional actions. The page <h1> is the section name in
 * the top bar (TopbarTitle), so this is an <h2>.
 */
export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-xl font-extrabold tracking-[-0.01em] lg:text-[22px]">{title}</h2>
        {description ? <p className="mt-1 text-[15px] text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-[#E2D8CA] px-4 py-8 text-center text-[15px] text-muted">{children}</p>;
}
