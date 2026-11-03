import { describe, expect, it } from "vitest";
import { formatPhone, isBgMobile, normalizePhone, phoneSearchDigits } from "./phone";

describe("normalizePhone", () => {
  it.each([
    ["+359887374755", "+359887374755"],
    ["+359 887 374 755", "+359887374755"],
    ["0887 374 755", "+359887374755"],
    ["0887-374-755", "+359887374755"],
    ["887374755", "+359887374755"],
    ["359887374755", "+359887374755"],
    ["00359887374755", "+359887374755"],
    ["+359 0887 374 755", "+359887374755"],
    ["(02) 123 4567", "+35921234567"],
    ["+44 20 7946 0958", "+442079460958"],
    ["0049 30 1234567", "+49301234567"],
  ])("%s → %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(["", "   ", "abc", "0887", "+359 12", "08873747551234", "+0123456789", "0887 374 755 ext 2"])(
    "rejects %j",
    (input) => {
      expect(normalizePhone(input)).toBeNull();
    },
  );
});

describe("isBgMobile / formatPhone", () => {
  it("detects Bulgarian mobile ranges", () => {
    expect(isBgMobile("+359887374755")).toBe(true);
    expect(isBgMobile("+359987654321")).toBe(true);
    expect(isBgMobile("+35921234567")).toBe(false);
  });

  it("formats for display", () => {
    expect(formatPhone("+359887374755")).toBe("+359 887 374 755");
    expect(formatPhone("+35921234567")).toBe("+359 2 123 4567");
    expect(formatPhone("+442079460958")).toBe("+442079460958");
  });
});

describe("phoneSearchDigits", () => {
  it("strips the national prefix in any form", () => {
    expect(phoneSearchDigits("0888 123")).toBe("888123");
    expect(phoneSearchDigits("+359 888 123")).toBe("888123");
    expect(phoneSearchDigits("00359888")).toBe("888");
    expect(phoneSearchDigits("08")).toBeNull();
    expect(phoneSearchDigits("Мария")).toBeNull();
  });
});
