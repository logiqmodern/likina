import { describe, expect, it } from "vitest";
import { parsePublicAnalyticsConfig } from "./public-config";

describe("parsePublicAnalyticsConfig", () => {
  it("empty → no tool is loaded", () => {
    expect(parsePublicAnalyticsConfig({})).toEqual({ ga4Id: null, metaPixelId: null, adsId: null, adsLabels: {} });
    expect(parsePublicAnalyticsConfig({ NEXT_PUBLIC_GA4_ID: "  " }).ga4Id).toBeNull();
  });

  it("accepts the known id formats", () => {
    expect(
      parsePublicAnalyticsConfig({
        NEXT_PUBLIC_GA4_ID: " G-AB12CD34EF ",
        NEXT_PUBLIC_META_PIXEL_ID: "123456789012345",
        NEXT_PUBLIC_GOOGLE_ADS_ID: "AW-1234567890",
        NEXT_PUBLIC_GOOGLE_ADS_BOOKING_LABEL: "AbC-dEf_123",
        NEXT_PUBLIC_GOOGLE_ADS_PHONE_LABEL: "ph0neLabel",
      }),
    ).toEqual({
      ga4Id: "G-AB12CD34EF",
      metaPixelId: "123456789012345",
      adsId: "AW-1234567890",
      adsLabels: { booking: "AbC-dEf_123", phone: "ph0neLabel" },
    });
  });

  it("ignores malformed ids (they end up in script URLs)", () => {
    const c = parsePublicAnalyticsConfig({
      NEXT_PUBLIC_GA4_ID: "UA-1234-1",
      NEXT_PUBLIC_META_PIXEL_ID: "12ab",
      NEXT_PUBLIC_GOOGLE_ADS_ID: "AW-12&x=<script>",
      NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL: "a/b",
    });
    expect(c).toEqual({ ga4Id: null, metaPixelId: null, adsId: null, adsLabels: {} });
  });
});
