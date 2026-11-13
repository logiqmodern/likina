import { describe, expect, it } from "vitest";
import { formatDimensions, parseDimensions, suggestSize } from "./artwork-size";

describe("parseDimensions", () => {
  it.each([
    ["• Размер: 30.5 x 19.5 см", { widthMm: 305, heightMm: 195, depthMm: null }],
    ["Размери: 35/35 см", { widthMm: 350, heightMm: 350, depthMm: null }],
    ["Размер на изображението: 16х21 см", { widthMm: 160, heightMm: 210, depthMm: null }],
    ["Размер: 48 x 35 x 2.5 см", { widthMm: 480, heightMm: 350, depthMm: 25 }],
    ["Размери в рамкиран вид: 32,5/27,5 см", { widthMm: 325, heightMm: 275, depthMm: null }],
    ["Размери в рамкиран вид: 27.5/33/3.5 см", { widthMm: 275, heightMm: 330, depthMm: 35 }],
    ["38,5 × 65,5 см", { widthMm: 385, heightMm: 655, depthMm: null }],
    ["• Размер: 23 x 17 cm", { widthMm: 230, heightMm: 170, depthMm: null }],
  ])("%s", (text, expected) => expect(parseDimensions(text)).toEqual(expected));

  it.each(["Размер: диаметър 20 см", "Размер с рамка: 5о/50 см", "без размер", "Размер: 0/0 см"])("no suggestion for %j", (text) =>
    expect(parseDimensions(text)).toBeNull(),
  );
});

describe("suggestSize", () => {
  it("prefers the framed size and keeps all lines in the note", () => {
    const s = suggestSize("Размери: 12/12 см\nРазмери с рамка: 29/29 см");
    expect(s).toMatchObject({ widthMm: 290, heightMm: 290, framed: true });
    expect(s?.note).toBe("Размери: 12/12 см\nРазмери с рамка: 29/29 см");
  });

  it("prints: the outer size with passe-partout and frame", () => {
    const s = suggestSize("Размер на изображението: 16х21 см\nВъншен размер с паспарту и рамка: 31/37 см");
    expect(s).toMatchObject({ widthMm: 310, heightMm: 370, framed: true });
  });

  it("reads the numbers from the next line", () => {
    expect(suggestSize("Размер с рамката:\n112 × 131 см")).toMatchObject({ widthMm: 1120, heightMm: 1310, framed: true });
  });

  it("'без рамка' is not the framed size", () => {
    expect(suggestSize("Размери: 30/30 см\nРазмери без рамка: 20/20 см")).toMatchObject({ widthMm: 300, framed: false });
  });

  it("unknown frame when the text does not say", () => {
    expect(suggestSize("• Размер: 30.5 x 19.5 см")).toMatchObject({ framed: null });
    expect(suggestSize("Изящна малка творба в малкия си размер")).toBeNull();
  });
});

describe("formatDimensions", () => {
  it("formats cm per language", () => {
    expect(formatDimensions({ widthMm: 305, heightMm: 195 }, "bg")).toBe("30,5 × 19,5 см");
    expect(formatDimensions({ widthMm: 480, heightMm: 350, depthMm: 25 }, "en")).toBe("48 × 35 × 2.5 cm");
    expect(formatDimensions({ widthMm: null, heightMm: 10 }, "bg")).toBeNull();
  });
});
