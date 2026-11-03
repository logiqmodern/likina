import { describe, expect, it } from "vitest";
import { CONTACTS_DEFAULT, resolveContacts, telHref } from "./contacts";

describe("contacts", () => {
  it("falls back to the defaults when the stored value is missing or invalid", () => {
    expect(resolveContacts(undefined)).toEqual(CONTACTS_DEFAULT);
    expect(resolveContacts({ phone: "x" })).toEqual(CONTACTS_DEFAULT);
  });

  it("uses a valid stored value", () => {
    const stored = { ...CONTACTS_DEFAULT, phone: "+359 888 000 000" };
    expect(resolveContacts(stored).phone).toBe("+359 888 000 000");
  });

  it("builds a tel: link from the displayed number", () => {
    expect(telHref("+359 899 857 525")).toBe("tel:+359899857525");
  });
});
