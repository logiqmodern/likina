"use client";

import { useActionState } from "react";
import { setInquiryStatusAction } from "@/app/admin/_actions/inquiries";
import { FormMessage } from "@/components/admin/forms";

type Status = "new" | "in_progress" | "done";

const NEXT: Array<{ status: Status; label: string }> = [
  { status: "new", label: "Ново" },
  { status: "in_progress", label: "В процес" },
  { status: "done", label: "Приключено" },
];

/** Segmented status switch for one inquiry (§10.2.9). */
export function InquiryStatusButtons({ id, status }: { id: string; status: Status }) {
  const [state, action, pending] = useActionState(setInquiryStatusAction, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={id} />
      <fieldset disabled={pending} aria-busy={pending || undefined}>
        <legend className="sr-only">Статус на запитването</legend>
        <div className="inline-flex flex-wrap gap-1.5">
          {NEXT.map((s) => {
            const current = s.status === status;
            return (
              <button
                key={s.status}
                type="submit"
                name="status"
                value={s.status}
                aria-pressed={current}
                className={`min-h-11 rounded-xl px-3.5 text-sm font-bold ${
                  current ? "bg-ink text-white" : "border-[1.5px] border-ink bg-white text-ink hover:bg-tint-50"
                } disabled:opacity-60`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </fieldset>
      {state && !state.ok ? <FormMessage state={state} /> : null}
    </form>
  );
}
