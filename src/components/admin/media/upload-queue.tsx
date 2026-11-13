"use client";

import { useEffect, useId, useRef, useState } from "react";
import { uploadMediaAction } from "@/app/(bg)/admin/_actions/media";
import { Button, TextField } from "@/components/admin/forms";
import { downscaleForUpload, UPLOAD_BODY_LIMIT } from "./downscale";
import { formatBytes, MAX_UPLOAD_BYTES_CLIENT, MAX_UPLOAD_MB, type MediaOption } from "./types";

interface QueueItem {
  key: string;
  file: File;
  previewUrl: string;
  alt: string;
  note: string;
  status: "ready" | "uploading" | "error";
  message?: string;
  fieldErrors?: Record<string, string>;
}

const ALT_HELP = "Какво има на снимката — чете се от незрящи потребители и от Google. Напр. „Икона на Св. Богородица Умиление в златна рамка“.";

/**
 * Pick one or more images, describe each (alt text is required) and upload
 * them one by one. Used on the media page and inside the image picker.
 */
export function UploadQueue({
  multiple = true,
  onUploaded,
}: {
  multiple?: boolean;
  onUploaded?: (item: MediaOption) => void;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const urls = useRef(new Set<string>());

  useEffect(() => {
    const set = urls.current;
    return () => set.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const added: QueueItem[] = [];
    const rejected: string[] = [];
    for (const file of Array.from(list).slice(0, multiple ? 20 : 1)) {
      if (file.type && !file.type.startsWith("image/")) {
        rejected.push(`„${file.name}“ не е снимка`);
        continue;
      }
      if (file.size > MAX_UPLOAD_BYTES_CLIENT) {
        rejected.push(`„${file.name}“ е ${formatBytes(file.size)} (до ${MAX_UPLOAD_MB} MB)`);
        continue;
      }
      const previewUrl = URL.createObjectURL(file);
      urls.current.add(previewUrl);
      added.push({ key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`, file, previewUrl, alt: "", note: "", status: "ready" });
    }
    setItems((prev) => (multiple ? [...prev, ...added] : added));
    setNotice(rejected.length ? { ok: false, text: `Не са добавени: ${rejected.join("; ")}.` } : null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function update(key: string, patch: Partial<QueueItem>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  function remove(key: string) {
    setItems((prev) => {
      const item = prev.find((i) => i.key === key);
      if (item) {
        URL.revokeObjectURL(item.previewUrl);
        urls.current.delete(item.previewUrl);
      }
      return prev.filter((i) => i.key !== key);
    });
  }

  async function upload(item: QueueItem): Promise<boolean> {
    if (!item.alt.trim()) {
      update(item.key, { status: "error", fieldErrors: { alt: "Опиши какво има на снимката — задължително е." }, message: undefined });
      return false;
    }
    update(item.key, { status: "uploading", message: undefined, fieldErrors: undefined });
    const file = await downscaleForUpload(item.file);
    if (file.size > UPLOAD_BODY_LIMIT) {
      update(item.key, {
        status: "error",
        message: "Снимката е твърде голяма за качване. Запази я като JPG и опитай пак.",
        fieldErrors: undefined,
      });
      return false;
    }
    const fd = new FormData();
    fd.set("file", file, file.name);
    fd.set("alt", item.alt);
    fd.set("note", item.note);
    try {
      const result = await uploadMediaAction(null, fd);
      if (!result.ok) {
        update(item.key, { status: "error", message: result.message, fieldErrors: result.fieldErrors });
        return false;
      }
      remove(item.key);
      onUploaded?.(result.data);
      setNotice({ ok: true, text: `„${result.data.alt}“ е качена.` });
      return true;
    } catch {
      update(item.key, {
        status: "error",
        message: "Качването не успя. Провери връзката и размера на файла (до 15 MB) и опитай пак.",
      });
      return false;
    }
  }

  async function uploadAll() {
    for (const item of items) {
      if (item.status === "uploading") continue;
      await upload(item);
    }
  }

  const busy = items.some((i) => i.status === "uploading");

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label htmlFor={inputId} className="field-label">
          {multiple ? "Избери снимки" : "Качи нова снимка"}
        </label>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple={multiple}
          onChange={(e) => addFiles(e.target.files)}
          aria-describedby={`${inputId}-help`}
          className="block w-full min-h-11 rounded-xl border-[1.5px] border-dashed border-[#D8CCBF] bg-white px-3 py-2.5 text-[16px] file:mr-3 file:min-h-10 file:rounded-xl file:border-0 file:bg-ink file:px-4 file:font-bold file:text-white"
        />
        <p id={`${inputId}-help`} className="field-help">
          JPG, PNG, WebP или HEIC до {MAX_UPLOAD_MB} MB. Снимките се оптимизират автоматично, а данните за място и
          устройство (EXIF) се премахват.
        </p>
      </div>

      <div aria-live="polite" role="status" className="empty:hidden">
        {notice ? (
          <p
            className={`rounded-xl border px-3.5 py-2.5 text-[15px] font-semibold ${
              notice.ok ? "border-success/30 bg-[#E3F2EA] text-[#1F5E3F]" : "border-error/30 bg-[#FDECEA] text-error"
            }`}
          >
            {notice.text}
          </p>
        ) : null}
      </div>

      {items.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li
              key={item.key}
              className="flex flex-col gap-3 rounded-2xl border border-[#E9E3DA] bg-[#FBFAF7] p-3 sm:flex-row"
              onKeyDown={(e) => {
                // Enter in a field uploads this image (and never submits a surrounding editor form).
                if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") {
                  e.preventDefault();
                  if (item.status !== "uploading") void upload(item);
                }
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local preview of a file not uploaded yet */}
              <img
                src={item.previewUrl}
                alt=""
                className="h-32 w-full shrink-0 rounded-xl bg-white object-contain sm:h-28 sm:w-28"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <p className="truncate text-[14px] text-muted">
                  {item.file.name} · {formatBytes(item.file.size)}
                </p>
                <TextField
                  name={`alt-${item.key}`}
                  label="Описание (alt текст)"
                  required
                  maxLength={300}
                  value={item.alt}
                  onChange={(e) => update(item.key, { alt: e.target.value })}
                  error={item.fieldErrors?.alt}
                  help={ALT_HELP}
                />
                <TextField
                  name={`note-${item.key}`}
                  label="Бележка (по избор, вижда се само в админа)"
                  maxLength={300}
                  value={item.note}
                  onChange={(e) => update(item.key, { note: e.target.value })}
                  error={item.fieldErrors?.note}
                  help="Напр. „Съгласие: писмено, 12.10.2026“ за снимки на клиенти."
                />
                {item.fieldErrors?.file ? <p className="field-error">{item.fieldErrors.file}</p> : null}
                {item.status === "error" && item.message ? (
                  <p role="alert" className="text-[14px] font-semibold text-error">
                    {item.message}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    pending={item.status === "uploading"}
                    pendingText="Качване…"
                    onClick={() => void upload(item)}
                  >
                    Качи
                  </Button>
                  <Button variant="ghost" disabled={item.status === "uploading"} onClick={() => remove(item.key)}>
                    Махни
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {items.length > 1 ? (
        <div>
          <Button variant="dark" pending={busy} pendingText="Качване…" onClick={() => void uploadAll()}>
            Качи всички ({items.length})
          </Button>
        </div>
      ) : null}
    </div>
  );
}
