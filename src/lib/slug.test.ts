import { describe, expect, it } from "vitest";
import { isValidSlug, slugify, uniqueSlug } from "./slug";

describe("slugify", () => {
  it.each([
    ["Света Богородица Умиление", "sveta-bogoroditsa-umilenie"],
    ["Вход Господен в Йерусалим /Цветница/", "vhod-gospoden-v-yerusalim-tsvetnitsa"],
    ["Картини със злато", "kartini-sas-zlato"],
    ["Нарът - символ на вечността", "narat-simvol-na-vechnostta"],
    ["Мария и България", "maria-i-bulgaria"],
    ["Тукан - авторски принт с 23 злато", "tukan-avtorski-print-s-23-zlato"],
    ["Щастие", "shtastie"],
  ])("%s → %s", (input, slug) => expect(slugify(input)).toBe(slug));

  it("caps the length without a trailing hyphen", () => {
    const s = slugify("а ".repeat(100));
    expect(s.length).toBeLessThanOrEqual(80);
    expect(isValidSlug(s)).toBe(true);
  });
});

describe("uniqueSlug", () => {
  it("adds a counter", () => {
    expect(uniqueSlug("tsvetya", new Set())).toBe("tsvetya");
    expect(uniqueSlug("tsvetya", new Set(["tsvetya", "tsvetya-2"]))).toBe("tsvetya-3");
  });
});
