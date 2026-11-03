import { describe, expect, it } from "vitest";
import { auditActionLabel, auditEntityHref, formatDiff, formatDiffValue } from "./audit-labels";

const ID = "3f1c2a4e-1111-4222-8333-944455556666";

describe("auditActionLabel", () => {
  it("translates known actions and keeps unknown ones raw", () => {
    expect(auditActionLabel("artwork.create")).toBe("Добавена творба");
    expect(auditActionLabel("something.new")).toBe("something.new");
  });
});

describe("auditEntityHref", () => {
  it("links to the affected record when possible", () => {
    expect(auditEntityHref("artwork", ID)).toBe(`/admin/tvorbi/${ID}`);
    expect(auditEntityHref("artwork", "not-a-uuid")).toBe("/admin/tvorbi");
    expect(auditEntityHref("order", ID)).toBe(`/admin/porachki/${ID}`);
    expect(auditEntityHref("inquiry", ID)).toBe("/admin/zapitvaniya");
    expect(auditEntityHref("unknown", "x")).toBeNull();
  });
});

describe("formatDiff", () => {
  it("renders from/to pairs and [before, after] arrays as arrows", () => {
    expect(formatDiff({ from: "confirmed", to: "completed" })).toEqual([{ key: "промяна", value: "confirmed → completed" }]);
    expect(formatDiff({ name: ["Стара", "Нова"], basePriceCents: [5900, 6900] })).toEqual([
      { key: "name", value: "Стара → Нова" },
      { key: "basePriceCents", value: "5900 → 6900" },
    ]);
  });

  it("formats plain values compactly", () => {
    expect(formatDiff({ open: true, note: null, ids: ["a", "b", "c"] })).toEqual([
      { key: "open", value: "да" },
      { key: "note", value: "—" },
      { key: "ids", value: '["a","b","c"]' },
    ]);
    expect(formatDiff(null)).toEqual([]);
    expect(formatDiffValue("x".repeat(200)).length).toBe(120);
  });
});
