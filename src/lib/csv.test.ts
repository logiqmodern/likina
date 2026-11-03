import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csv", () => {
  it("quotes separators, quotes and new lines", () => {
    expect(csvCell('Мария "Мими"')).toBe('"Мария ""Мими"""');
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell("ред 1\nред 2")).toBe('"ред 1\nред 2"');
    expect(csvCell("a;b")).toBe('"a;b"');
  });

  it("neutralizes formulas but keeps numbers", () => {
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("+359888123456")).toBe("'+359888123456");
    expect(csvCell(-5)).toBe("-5");
    expect(csvCell(12.5)).toBe("12.5");
  });

  it("empty values and BOM + CRLF", () => {
    expect(csvCell(null)).toBe("");
    expect(toCsv(["a", "b"], [[1, null]])).toBe("﻿a,b\r\n1,\r\n");
  });
});
