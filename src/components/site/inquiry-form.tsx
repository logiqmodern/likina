"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { submitInquiry } from "@/app/_actions/inquiry";
import { messages, type Lang } from "@/i18n";
import {
  FORM_ERROR_KEY,
  HONEYPOT_FIELD,
  INITIAL_INQUIRY_STATE,
  INQUIRY_FIELD_RULES,
  INQUIRY_MAX_LENGTH,
  INQUIRY_TYPE_FIELD,
  type InquiryField,
  type InquiryType,
} from "@/lib/inquiry-fields";

const FIELD_DEFS: Record<InquiryField, { autoComplete: string; type?: "text" | "tel" | "email"; multiline?: boolean }> = {
  name: { autoComplete: "name" },
  phone: { autoComplete: "tel", type: "tel" },
  email: { autoComplete: "email", type: "email" },
  subject: { autoComplete: "off" },
  size: { autoComplete: "off" },
  deadline: { autoComplete: "off" },
  message: { autoComplete: "off", multiline: true },
  artwork: { autoComplete: "off" },
};

const SUCCESS = {
  bg: "Получихме запитването Ви и ще се свържем с Вас до 1–2 работни дни.",
  en: "We have received your enquiry and will get back to you within 1–2 working days.",
};

/** Inquiry form (§4.4) → submitInquiry. Validation on the server; values are kept on error. */
export function InquiryForm({
  lang,
  type,
  fields,
  initial = {},
}: {
  lang: Lang;
  type: InquiryType;
  fields: InquiryField[];
  initial?: Partial<Record<InquiryField, string>>;
}) {
  const t = messages[lang].forms;
  const [state, formAction, pending] = useActionState(submitInquiry, INITIAL_INQUIRY_STATE);
  const uid = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const rules = INQUIRY_FIELD_RULES[type];
  const shown = fields.filter((f) => rules[f]);
  const errors = state.status === "error" ? (state.errors ?? {}) : {};
  const values = { ...initial, ...(state.values ?? {}) };
  const fieldErrorCount = shown.filter((f) => errors[f]).length;

  useEffect(() => {
    if (state.status !== "error") return;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);

  return (
    <div className="flex flex-col gap-4">
      <div aria-live="polite" role="status">
        {state.status === "success" ? (
          <div className="flex flex-col gap-2">
            <h2 className="h3">{t.thanks}</h2>
            <p className="text-ink-2">{SUCCESS[lang]}</p>
          </div>
        ) : state.status === "error" ? (
          <p className="rounded-xl border border-error bg-white px-4 py-3 font-semibold text-error">
            {errors[FORM_ERROR_KEY] ?? (fieldErrorCount === 1 ? t.errorOne : t.errorMany)}
          </p>
        ) : null}
      </div>

      {state.status !== "success" ? (
        <form ref={formRef} action={formAction} noValidate className="flex flex-col gap-4">
          <input type="hidden" name={INQUIRY_TYPE_FIELD} value={type} />
          <input type="hidden" name="lang" value={lang} />
          <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label htmlFor={`${uid}-hp`}>Website</label>
            <input id={`${uid}-hp`} type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
          </div>
          {shown.map((field) => {
            const def = FIELD_DEFS[field];
            const required = rules[field] === "required";
            const error = errors[field];
            const props = {
              id: `${uid}-${field}`,
              name: field,
              autoComplete: def.autoComplete,
              maxLength: INQUIRY_MAX_LENGTH[field],
              defaultValue: values[field] ?? "",
              "aria-required": required || undefined,
              "aria-invalid": error ? true : undefined,
              "aria-describedby": error ? `${uid}-${field}-error` : undefined,
            } as const;
            return (
              <div key={field}>
                <label htmlFor={props.id} className="field-label">
                  {t[field]}
                  {!required ? <span className="font-medium text-muted"> {t.optional}</span> : null}
                </label>
                {def.multiline ? (
                  <textarea {...props} rows={5} className="field-input min-h-32 resize-y" />
                ) : (
                  <input {...props} type={def.type ?? "text"} className="field-input" />
                )}
                {error ? (
                  <p id={`${uid}-${field}-error`} className="field-error">
                    {error}
                  </p>
                ) : null}
              </div>
            );
          })}
          <button type="submit" disabled={pending} className="btn btn-primary btn-lg">
            {pending ? t.sending : t.send}
          </button>
        </form>
      ) : null}
    </div>
  );
}
