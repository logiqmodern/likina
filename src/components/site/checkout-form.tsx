"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { placeOrder, type CheckoutState } from "@/app/_actions/checkout";
import { formatEur } from "@/domain/pricing";
import { href, messages, type Lang } from "@/i18n";

type Delivery = "econt_office" | "econt_address" | "econt_locker" | "pickup";

/** One-page checkout form (§6.2). Server validation; entered values survive an error. */
export function CheckoutForm({
  lang,
  cardEnabled,
  totals,
}: {
  lang: Lang;
  cardEnabled: boolean;
  totals: { delivered: number; pickup: number; pickupDiscount: number };
}) {
  const t = messages[lang].checkout;
  const [state, action, pending] = useActionState<CheckoutState, FormData>(placeOrder, { status: "idle" });
  const v = state.values ?? {};
  const err = state.errors ?? {};
  const [delivery, setDelivery] = useState<Delivery>((v.deliveryMethod as Delivery) || "econt_office");
  const [payment, setPayment] = useState<string>(v.paymentMethod || (cardEnabled ? "mypos" : "cod"));
  const [invoice, setInvoice] = useState(!!v.invoice);
  const uid = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const pickup = delivery === "pickup";
  const pay = pickup && payment === "cod" ? "on_pickup" : !pickup && payment === "on_pickup" ? "cod" : payment;
  const total = pickup ? totals.pickup : totals.delivered;

  useEffect(() => {
    if (state.status === "error") formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);

  const field = (name: string, label: string, opts: { type?: string; autoComplete?: string; optional?: boolean; inputMode?: "tel" | "email" | "numeric" } = {}) => (
    <div>
      <label htmlFor={`${uid}-${name}`} className="field-label">
        {label}
        {opts.optional ? <span className="font-medium text-muted"> {t.optional}</span> : null}
      </label>
      <input
        id={`${uid}-${name}`}
        name={name}
        type={opts.type ?? "text"}
        inputMode={opts.inputMode}
        autoComplete={opts.autoComplete ?? "off"}
        defaultValue={v[name] ?? ""}
        aria-invalid={err[name] ? true : undefined}
        aria-describedby={err[name] ? `${uid}-${name}-e` : undefined}
        className="field-input"
      />
      {err[name] ? (
        <p id={`${uid}-${name}-e`} className="field-error">
          {err[name]}
        </p>
      ) : null}
    </div>
  );

  const option = (group: string, value: string, label: string, hint: string | null, checked: boolean, onChange: () => void, disabled = false) => (
    <label className={`flex cursor-pointer gap-3 rounded-xl border-[1.5px] bg-white p-4 has-checked:border-ink has-focus-visible:outline-3 has-focus-visible:outline-offset-2 ${disabled ? "cursor-not-allowed opacity-60" : "border-line"}`}>
      <input type="radio" name={group} value={value} checked={checked} onChange={onChange} disabled={disabled} className="mt-1 h-5 w-5 shrink-0 accent-[var(--ink)]" />
      <span className="flex flex-col gap-0.5">
        <span className="font-bold">{label}</span>
        {hint ? <span className="text-[14px] text-ink-2">{hint}</span> : null}
      </span>
    </label>
  );

  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-8">
      <input type="hidden" name="lang" value={lang} />
      <div aria-live="polite" role="status">
        {err._form ? <p className="rounded-xl border border-error bg-white px-4 py-3 font-semibold text-error">{err._form}</p> : null}
      </div>

      <fieldset className="flex flex-col gap-4">
        <legend className="h3 mb-3">{t.contact}</legend>
        {field("name", t.name, { autoComplete: "name" })}
        {field("email", t.email, { type: "email", autoComplete: "email", inputMode: "email" })}
        {field("phone", t.phone, { type: "tel", autoComplete: "tel", inputMode: "tel" })}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="h3 mb-3">{t.delivery}</legend>
        {option("deliveryMethod", "econt_office", t.econtOffice, null, delivery === "econt_office", () => setDelivery("econt_office"))}
        {option("deliveryMethod", "econt_address", t.econtAddress, null, delivery === "econt_address", () => setDelivery("econt_address"))}
        {option("deliveryMethod", "econt_locker", t.econtLocker, null, delivery === "econt_locker", () => setDelivery("econt_locker"))}
        {option("deliveryMethod", "pickup", t.pickup, t.pickupHint, pickup, () => setDelivery("pickup"))}
        {!pickup ? (
          <div className="mt-2 grid gap-4 sm:grid-cols-[2fr_1fr]">
            {field("city", t.city, { autoComplete: "address-level2" })}
            {field("postCode", t.postCode, { autoComplete: "postal-code", optional: true, inputMode: "numeric" })}
            <div className="sm:col-span-2">
              {delivery === "econt_address"
                ? field("address", t.address, { autoComplete: "street-address" })
                : field("office", delivery === "econt_locker" ? t.locker : t.office)}
            </div>
          </div>
        ) : null}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="h3 mb-3">{t.payment}</legend>
        {option("paymentMethod", "mypos", t.card, cardEnabled ? t.cardHint : t.cardUnavailable, pay === "mypos", () => setPayment("mypos"), !cardEnabled)}
        {pickup
          ? option("paymentMethod", "on_pickup", t.onPickup, t.onPickupHint, pay === "on_pickup", () => setPayment("on_pickup"))
          : option("paymentMethod", "cod", t.cod, t.codHint, pay === "cod", () => setPayment("cod"))}
        {err.paymentMethod ? <p className="field-error">{err.paymentMethod}</p> : null}
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <label className="flex items-center gap-3 font-semibold">
          <input type="checkbox" name="invoice" value="1" checked={invoice} onChange={(e) => setInvoice(e.target.checked)} className="h-5 w-5 accent-[var(--ink)]" />
          {t.invoice}
        </label>
        {invoice ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {field("company", t.company, { autoComplete: "organization" })}
            {field("eik", t.eik)}
            {field("vat", t.vat, { optional: true })}
            {field("mol", t.mol)}
            <div className="sm:col-span-2">{field("companyAddress", t.companyAddress)}</div>
          </div>
        ) : null}
        <div>
          <label htmlFor={`${uid}-notes`} className="field-label">
            {t.notes} <span className="font-medium text-muted">{t.optional}</span>
          </label>
          <textarea id={`${uid}-notes`} name="notes" rows={3} maxLength={1000} defaultValue={v.notes ?? ""} className="field-input min-h-24 resize-y" />
        </div>
      </fieldset>

      <div className="flex flex-col gap-3">
        {pickup && totals.pickupDiscount ? (
          <p className="flex justify-between text-[15px]">
            <span>{t.discount}</span>
            <span className="tabular-nums">−{formatEur(totals.pickupDiscount, lang)}</span>
          </p>
        ) : null}
        <label className="flex gap-3">
          <input type="checkbox" name="terms" value="1" defaultChecked={!!v.terms} aria-invalid={err.terms ? true : undefined} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--ink)]" />
          <span>
            {t.terms} (
            <Link href={href.page(lang, "terms")} className="link" target="_blank">
              {lang === "bg" ? "Общи условия" : "Terms"}
            </Link>
            )
          </span>
        </label>
        {err.terms ? <p className="field-error">{err.terms}</p> : null}
        <label className="flex gap-3 text-[15px] text-ink-2">
          <input type="checkbox" name="marketing" value="1" defaultChecked={!!v.marketing} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--ink)]" />
          {t.marketing}
        </label>
        <button type="submit" disabled={pending} className="btn btn-primary btn-lg">
          {pay === "mypos" ? t.payCard(formatEur(total, lang)) : pay === "cod" ? t.placeCod : t.placePickup}
        </button>
      </div>
    </form>
  );
}
