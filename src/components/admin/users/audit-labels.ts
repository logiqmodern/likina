/*
 * Audit log (§10.2.13): Bulgarian labels for actions and entities, links to
 * the affected record, and a compact readable diff. Pure.
 */

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "artwork.create": "Добавена творба",
  "artwork.update": "Променена творба",
  "artwork.sold": "Творба: продадена",
  "artwork.delete": "Изтрита творба",
  "order.status": "Статус на поръчка",
  "order.notes": "Бележка към поръчка",
  "settings.update": "Променени настройки",
  "inquiry.status": "Статус на запитване",
  "media.upload": "Качена снимка",
  "media.update": "Променено описание на снимка",
  "media.delete": "Изтрита снимка",
  "user.invite": "Поканен потребител",
  "user.invite_revoke": "Отменена покана",
  "user.create": "Приета покана (нов профил)",
  "user.activate": "Активиран профил",
  "user.deactivate": "Деактивиран профил",
  "user.reset_2fa": "Нулиран двуфакторен вход",
};

export function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

export const AUDIT_ENTITY_LABELS: Record<string, string> = {
  artwork: "Творби",
  order: "Поръчки",
  settings: "Настройки",
  inquiry: "Запитвания",
  media: "Снимки",
  admin_user: "Потребители",
};

export function auditEntityLabel(entity: string): string {
  return AUDIT_ENTITY_LABELS[entity] ?? entity;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Admin link for the affected record, when one can be built. */
export function auditEntityHref(entity: string, entityId: string | null): string | null {
  const id = entityId ?? "";
  switch (entity) {
    case "artwork":
      return UUID.test(id) ? `/admin/tvorbi/${id}` : "/admin/tvorbi";
    case "order":
      return UUID.test(id) ? `/admin/porachki/${id}` : "/admin/porachki";
    case "settings":
      return "/admin/nastroyki";
    case "inquiry":
      return "/admin/zapitvaniya";
    case "admin_user":
      return "/admin/nastroyki/potrebiteli";
    default:
      return null;
  }
}

/** Short human text for one diff value. */
export function formatDiffValue(v: unknown, max = 120): string {
  let s: string;
  if (v === null || v === undefined) s = "—";
  else if (typeof v === "boolean") s = v ? "да" : "не";
  else if (typeof v === "string") s = v === "" ? "„“" : v;
  else if (typeof v === "number") s = String(v);
  else s = JSON.stringify(v);
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/**
 * Diff → rows "key: value". {from, to} pairs and [before, after] arrays
 * (as written by service.update) become "before → after".
 */
export function formatDiff(diff: Record<string, unknown> | null | undefined): Array<{ key: string; value: string }> {
  if (!diff) return [];
  const entries = Object.entries(diff);
  const keys = new Set(Object.keys(diff));
  if (keys.size === 2 && keys.has("from") && keys.has("to")) {
    return [{ key: "промяна", value: `${formatDiffValue(diff.from)} → ${formatDiffValue(diff.to)}` }];
  }
  return entries.map(([key, value]) => {
    if (Array.isArray(value) && value.length === 2 && value.every((x) => x === null || ["string", "number", "boolean"].includes(typeof x))) {
      return { key, value: `${formatDiffValue(value[0])} → ${formatDiffValue(value[1])}` };
    }
    if (value && typeof value === "object" && !Array.isArray(value) && "from" in value && "to" in value && Object.keys(value).length === 2) {
      const o = value as { from: unknown; to: unknown };
      return { key, value: `${formatDiffValue(o.from)} → ${formatDiffValue(o.to)}` };
    }
    return { key, value: formatDiffValue(value) };
  });
}
