import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

/*
 * Social preview image (§11): brand template + the page title.
 * /og?t=<title> — used by cmsMetadata() for pages without a CMS image.
 * Colours: docs/DESIGN.md (ink on blush; never white text on pink).
 */

const FONT_DIR = path.join(process.cwd(), "src/assets/og-fonts");
const TITLE_MAX = 90;

async function fonts() {
  const load = (f: string) => readFile(path.join(FONT_DIR, f));
  const [c8, l8, c6, l6] = await Promise.all([
    load("manrope-cyrillic-800-normal.woff"),
    load("manrope-latin-800-normal.woff"),
    load("manrope-cyrillic-600-normal.woff"),
    load("manrope-latin-600-normal.woff"),
  ]);
  return [
    { name: "Manrope", data: c8, weight: 800 as const, style: "normal" as const },
    { name: "Manrope", data: l8, weight: 800 as const, style: "normal" as const },
    { name: "Manrope", data: c6, weight: 600 as const, style: "normal" as const },
    { name: "Manrope", data: l6, weight: 600 as const, style: "normal" as const },
  ];
}

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("t")?.trim() ?? "";
  const title = (raw || "Студио за оформяне на тялото в София").slice(0, TITLE_MAX);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          backgroundColor: "#FDF3F8",
          color: "#2B1A26",
          fontFamily: "Manrope",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
          <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: 4 }}>LIKINA</span>
          <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: 6 }}>ART GALLERY</span>
        </div>
        <div style={{ display: "flex", fontSize: title.length > 50 ? 60 : 72, fontWeight: 800, lineHeight: 1.1, maxWidth: 1000 }}>
          {title}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 28, fontWeight: 600 }}>
          <span>София</span>
          <span>likina.com</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: await fonts(),
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400" },
    },
  );
}
