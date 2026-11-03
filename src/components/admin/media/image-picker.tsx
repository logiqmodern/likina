"use client";

import Image from "next/image";
import { useId, useState } from "react";
import { Button, Sheet } from "@/components/admin/forms";
import { mediaSrc, type MediaOption } from "./types";
import { UploadQueue } from "./upload-queue";

/** Merges server props with images uploaded in this session (newest first, no duplicates). */
function useLibrary(media: MediaOption[]) {
  const [uploaded, setUploaded] = useState<MediaOption[]>([]);
  const ids = new Set(media.map((m) => m.id));
  const all = [...uploaded.filter((u) => !ids.has(u.id)), ...media];
  return {
    all,
    add: (m: MediaOption) => setUploaded((prev) => (prev.some((p) => p.id === m.id) || ids.has(m.id) ? prev : [m, ...prev])),
  };
}

export function MediaThumb({ item, sizes = "96px", className = "" }: { item: MediaOption; sizes?: string; className?: string }) {
  return (
    <span className={`relative block overflow-hidden rounded-xl bg-[#F1EBEF] ${className}`}>
      <Image src={mediaSrc(item.id)} alt={item.alt} fill sizes={sizes} className="object-cover" />
    </span>
  );
}

/**
 * Sheet with the media library: choose an image or upload a new one inline
 * (it is selected right away). `onSelect(null)` is never called — removing
 * the selection is the field's job.
 */
export function ImagePickerSheet({
  open,
  onClose,
  media,
  selectedId,
  onSelect,
  title = "Избери снимка",
  excludeIds = [],
}: {
  open: boolean;
  onClose: () => void;
  media: MediaOption[];
  selectedId?: string | null;
  onSelect: (item: MediaOption) => void;
  title?: string;
  excludeIds?: string[];
}) {
  const lib = useLibrary(media);
  const [showUpload, setShowUpload] = useState(false);
  const available = lib.all.filter((m) => !excludeIds.includes(m.id));

  return (
    <Sheet open={open} onClose={onClose} title={title} wide>
      <div className="flex flex-col gap-4">
        {showUpload ? (
          <div className="rounded-2xl border border-[#ECE6EA] p-3">
            <UploadQueue
              multiple={false}
              onUploaded={(item) => {
                lib.add(item);
                setShowUpload(false);
                onSelect(item);
              }}
            />
            <Button variant="ghost" onClick={() => setShowUpload(false)}>
              Откажи качването
            </Button>
          </div>
        ) : (
          <div>
            <Button variant="secondary" onClick={() => setShowUpload(true)}>
              + Качи нова снимка
            </Button>
          </div>
        )}

        {available.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#E2D6DE] px-4 py-6 text-center text-[15px] text-muted">
            Медията е празна. Качи първата снимка.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" aria-label="Снимки в медията">
            {available.map((m) => {
              const selected = m.id === selectedId;
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(m)}
                    aria-pressed={selected}
                    className={`flex w-full flex-col gap-1.5 rounded-2xl border-2 p-1.5 text-left hover:border-ink ${
                      selected ? "border-ink bg-blush-50" : "border-transparent"
                    }`}
                  >
                    <MediaThumb item={m} className="aspect-square w-full" sizes="(min-width: 640px) 200px, 45vw" />
                    <span className="line-clamp-2 px-1 text-[13px] leading-snug text-ink-2">
                      {selected ? <strong className="text-ink">Избрана · </strong> : null}
                      {m.alt}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Sheet>
  );
}

/** A form field holding one media id: thumbnail + choose / change / remove. */
export function ImagePickerField({
  label,
  help,
  value,
  onChange,
  media,
  error,
}: {
  label: string;
  help?: React.ReactNode;
  value: string | null;
  onChange: (id: string | null) => void;
  media: MediaOption[];
  error?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const lib = useLibrary(media);
  const selected = value ? (lib.all.find((m) => m.id === value) ?? null) : null;
  const describedBy = [help ? `${id}-help` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;

  return (
    <div role="group" aria-labelledby={`${id}-label`} aria-describedby={describedBy}>
      <span id={`${id}-label`} className="field-label">
        {label}
      </span>
      <div className="flex items-center gap-3 rounded-xl border-[1.5px] border-[#E2D6DE] bg-white p-2.5">
        {selected ? (
          <MediaThumb item={selected} className="size-20 shrink-0" sizes="80px" />
        ) : (
          <span className="flex size-20 shrink-0 items-center justify-center rounded-xl bg-[#F1EBEF] text-[12px] text-muted">
            {value ? "Няма я" : "Без снимка"}
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="line-clamp-2 text-[14px] text-ink-2">
            {selected ? selected.alt : value ? "Снимката не е намерена в медията." : "Не е избрана снимка."}
          </span>
          <span className="flex flex-wrap gap-2">
            <Button variant="secondary" className="px-4 text-[15px]" onClick={() => setOpen(true)}>
              {value ? "Смени" : "Избери снимка"}
            </Button>
            {value ? (
              <Button variant="ghost" className="px-2 text-[15px]" onClick={() => onChange(null)}>
                Махни
              </Button>
            ) : null}
          </span>
        </div>
      </div>
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
      <ImagePickerSheet
        open={open}
        onClose={() => setOpen(false)}
        media={lib.all}
        selectedId={value}
        title={label}
        onSelect={(m) => {
          lib.add(m);
          onChange(m.id);
          setOpen(false);
        }}
      />
    </div>
  );
}
