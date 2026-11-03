import Form from "next/form";
import Link from "next/link";

/**
 * Filter tabs as links (the URL is the state). Horizontally scrollable on a
 * narrow phone instead of wrapping into an uneven second row.
 */
export function LinkTabs({
  label,
  tabs,
}: {
  label: string;
  tabs: Array<{ href: string; label: string; count?: number; current: boolean }>;
}) {
  return (
    <nav aria-label={label} className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-1.5 rounded-2xl border border-[#E9E3DA] bg-white p-1.5">
        {tabs.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              aria-current={t.current ? "page" : undefined}
              className={`flex min-h-11 items-center gap-2 whitespace-nowrap rounded-xl px-3.5 text-[15px] font-bold ${
                t.current ? "bg-ink text-white" : "text-ink-2 hover:bg-tint-50"
              }`}
            >
              {t.label}
              {t.count !== undefined ? (
                <span
                  className={`rounded-full px-2 py-px text-xs font-extrabold tabular-nums ${
                    t.current ? "bg-white/20 text-white" : "bg-[#F1ECE4] text-ink"
                  }`}
                >
                  {t.count}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Search box as a GET form; keeps the other params as hidden fields. */
export function SearchForm({
  action,
  value,
  placeholder,
  label,
  hidden = {},
}: {
  action: string;
  value: string;
  placeholder: string;
  label: string;
  hidden?: Record<string, string>;
}) {
  return (
    <Form action={action} role="search" className="flex min-w-0 flex-1 gap-2">
      {Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <label className="flex min-w-0 flex-1 flex-col">
        <span className="sr-only">{label}</span>
        <input
          type="search"
          name="q"
          defaultValue={value}
          placeholder={placeholder}
          autoComplete="off"
          className="field-input min-h-11 py-2 text-base"
        />
      </label>
      <button type="submit" className="btn btn-dark min-h-11 shrink-0 px-4">
        Търси
      </button>
    </Form>
  );
}
