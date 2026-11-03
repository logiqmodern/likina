"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { deleteMediaAction, updateMediaAction } from "@/app/admin/_actions/media";
import { Button, FormMessage, TextField } from "@/components/admin/forms";
import { useSubmitKeepingValues } from "@/components/admin/common/use-keep-values";
import { MediaThumb } from "./image-picker";
import { formatBytes, type MediaOption } from "./types";

export interface MediaGridItem extends MediaOption {
  note: string | null;
  bytes: number;
  /** "14.10.2026, 10:05" */
  uploadedText: string;
  /** content that uses this image (deletion is refused while non-empty) */
  usedBy: Array<{ label: string; href: string | null }>;
}

/** The media library: every image with its alt text, where it is used, edit and delete. */
export function MediaGrid({ items }: { items: MediaGridItem[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" aria-label="Снимки">
      {items.map((item) => (
        <MediaCard key={item.id} item={item} />
      ))}
    </ul>
  );
}

function MediaCard({ item }: { item: MediaGridItem }) {
  const [editing, setEditing] = useState(false);
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-[#E9E3DA] bg-white p-3 shadow-[0_1px_2px_rgba(42,31,26,0.04)]">
      <a href={`/media/${item.id}`} target="_blank" rel="noopener" className="block" aria-label={`Отвори „${item.alt}“ в пълен размер`}>
        <MediaThumb item={item} className="aspect-[4/3] w-full" sizes="(min-width: 1536px) 22vw, (min-width: 1280px) 30vw, (min-width: 640px) 45vw, 92vw" />
      </a>
      {editing ? (
        <EditMedia item={item} onDone={() => setEditing(false)} />
      ) : (
        <div className="flex flex-col gap-1">
          <p className="text-[15px] font-semibold leading-snug">{item.alt}</p>
          {item.note ? <p className="text-[14px] text-ink-2">Бележка: {item.note}</p> : null}
          <p className="text-[13px] text-muted">
            {item.width}×{item.height} px · {formatBytes(item.bytes)} · {item.uploadedText}
          </p>
          <UsedBy usedBy={item.usedBy} />
          <div className="mt-1 flex flex-wrap gap-2">
            <Button variant="secondary" className="px-4 text-[15px]" onClick={() => setEditing(true)} aria-label={`Редактирай описанието на „${item.alt}“`}>
              Редактирай
            </Button>
            <DeleteMedia item={item} />
          </div>
        </div>
      )}
    </li>
  );
}

function UsedBy({ usedBy }: { usedBy: MediaGridItem["usedBy"] }) {
  if (usedBy.length === 0) return <p className="text-[13px] text-muted">Не се използва никъде.</p>;
  return (
    <div className="text-[13px] text-ink-2">
      <span className="font-semibold">Използва се в:</span>{" "}
      {usedBy.map((u, i) => (
        <span key={`${u.label}-${i}`}>
          {i > 0 ? "; " : null}
          {u.href ? (
            <Link href={u.href} className="link">
              {u.label}
            </Link>
          ) : (
            u.label
          )}
        </span>
      ))}
    </div>
  );
}

function EditMedia({ item, onDone }: { item: MediaGridItem; onDone: () => void }) {
  const [state, dispatch, pending] = useActionState(updateMediaAction, null);
  const onSubmit = useSubmitKeepingValues(dispatch);
  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <input type="hidden" name="id" value={item.id} />
      <TextField name="alt" label="Описание (alt текст)" state={state} defaultValue={item.alt} required maxLength={300} help="Задължително. Какво има на снимката." />
      <TextField name="note" label="Бележка (по избор)" state={state} defaultValue={item.note ?? ""} maxLength={300} />
      <FormMessage state={state} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="primary" pending={pending} pendingText="Запазване…">
          Запази
        </Button>
        <Button variant="ghost" onClick={onDone}>
          {state?.ok ? "Готово" : "Откажи"}
        </Button>
      </div>
    </form>
  );
}

function DeleteMedia({ item }: { item: MediaGridItem }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inUse = item.usedBy.length > 0;

  return (
    <>
      {confirming ? (
        <span className="flex w-full flex-col gap-2">
          <span className="text-[15px] font-semibold">Да изтрия ли снимката завинаги?</span>
          <span className="flex flex-wrap gap-2">
            <Button
              variant="danger"
              pending={pending}
              pendingText="Изтриване…"
              onClick={() =>
                startTransition(async () => {
                  const r = await deleteMediaAction(item.id);
                  if (!r.ok) {
                    setError(r.message);
                    setConfirming(false);
                  }
                })
              }
            >
              Да, изтрий
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Не
            </Button>
          </span>
        </span>
      ) : (
        <Button
          variant="danger"
          className="px-4 text-[15px]"
          disabled={inUse}
          title={inUse ? "Снимката се използва — махни я първо оттам." : undefined}
          onClick={() => {
            setError(null);
            setConfirming(true);
          }}
        >
          Изтрий
        </Button>
      )}
      <span aria-live="polite" role="status" className="w-full text-[14px] font-semibold text-error empty:hidden">
        {error}
      </span>
      {inUse ? <span className="w-full text-[13px] text-muted">Използвана снимка не може да се изтрие.</span> : null}
    </>
  );
}
