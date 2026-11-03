import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, resolveSettings } from "./settings";

describe("settings", () => {
  it("defaults reflect the confirmed answers", () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      reservationMinutes: 15,
      shipsInDaysMin: 2,
      shipsInDaysMax: 3,
      pickupDiscountPercent: 5,
      shippingModel: "included",
      sellerEmail: null,
    });
  });

  it("stored values override defaults; unknown keys are ignored", () => {
    const { settings, invalidKeys } = resolveSettings([
      { key: "reservationMinutes", value: 20 },
      { key: "somethingElse", value: 1 },
    ]);
    expect(settings.reservationMinutes).toBe(20);
    expect(invalidKeys).toEqual([]);
  });

  it("an invalid stored value falls back to the default and is reported", () => {
    const { settings, invalidKeys } = resolveSettings([
      { key: "reservationMinutes", value: "fifteen" },
      { key: "sellerEmail", value: "not-an-email" },
    ]);
    expect(settings.reservationMinutes).toBe(15);
    expect(settings.sellerEmail).toBeNull();
    expect(invalidKeys).toEqual(["reservationMinutes", "sellerEmail"]);
  });
});
