import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { artists, artworkImages, artworks, categories, reviews } from "@/db/schema";
import { createTestDb, hasDatabase, resetDb } from "@/test/db";
import { importLegacyCatalog, type LegacyCatalog } from "./legacy-import";

describe.skipIf(!hasDatabase)("legacy catalogue import (Postgres)", () => {
  const { db, pool } = hasDatabase ? createTestDb() : ({} as ReturnType<typeof createTestDb>);

  beforeEach(async () => {
    await resetDb(db);
  });

  afterAll(async () => {
    await pool?.end();
  });

  const img = (id: number, file: string) => ({ id, file, alt: "", title: "il_fullxfull.123" });
  const catalog: LegacyCatalog = {
    products: [
      {
        wpId: 5378,
        status: "publish",
        title: "Исус Христос Пантократор",
        slug: "исус-христос-пантократор",
        excerpt: "• Размер: 30.5 x 19.5 см\n• Зограф: Гергана НИКИФОРОВА\n\nТази икона е изцяло ръчно изрисувана.",
        content: "✓ Сертификат за автентичност на творбата",
        dateGmt: "2026-03-01T10:00:00Z",
        priceCents: 47_000,
        regularCents: 47_000,
        saleCents: null,
        stockStatus: "instock",
        categories: ["available-icons", "gergana-nikiforova", "hand-painted-icons"],
        images: [img(1, "2026/03/a.jpg"), img(2, "2026/03/b.jpg")],
      },
      {
        wpId: 5374,
        status: "publish",
        title: "Земеродно рибарче",
        slug: "земеродно-рибарче",
        excerpt: "Размери в рамкиран вид: 28/28 см",
        content: "",
        dateGmt: "2026-03-01T10:00:00Z",
        priceCents: 0,
        regularCents: 0,
        saleCents: null,
        stockStatus: "outofstock",
        categories: ["gergana-nikiforova", "gold-paintings-landscapes-stilllife"],
        images: [img(2, "2026/03/b.jpg")],
      },
    ],
    categories: [],
    reviews: [{ name: "Peter", text: "Lovingly packaged." }],
    aboutHtml: "<h2>Гергана Никифорова</h2><p>Биография.</p><h2>Румен Божинов</h2><p>Друга.</p>",
  };

  it("imports artworks, images, categories, artists and reviews — and is idempotent", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "likina-import-"));
    await mkdir(path.join(dir, "2026/03"), { recursive: true });
    const jpg = await sharp({ create: { width: 40, height: 30, channels: 3, background: "#c99a3e" } }).jpeg().toBuffer();
    await writeFile(path.join(dir, "2026/03/a.jpg"), jpg);
    await writeFile(path.join(dir, "2026/03/b.jpg"), jpg);

    const first = await importLegacyCatalog(db, catalog, { uploadsDir: dir });
    expect(first.artworks.created).toBe(2);
    expect(first.images).toMatchObject({ created: 2, missing: [] });
    expect(first.certificateRemoved).toBe(1);

    const [icon] = await db.select().from(artworks).where(eq(artworks.legacyWpId, 5378));
    expect(icon).toMatchObject({
      slug: "isus-hristos-pantokrator",
      status: "available",
      kind: "original",
      priceCents: 47_000,
      widthMm: 305,
      heightMm: 195,
      sizeNeedsCheck: true,
      legacySlug: "исус-христос-пантократор",
      descriptionBg: "<p>Тази икона е изцяло ръчно изрисувана.</p>",
    });
    const imgs = await db.select().from(artworkImages).where(eq(artworkImages.artworkId, icon!.id)).orderBy(artworkImages.sortOrder);
    expect(imgs.map((i) => i.altBg)).toEqual(["Исус Христос Пантократор — Гергана Никифорова", "Исус Христос Пантократор — Гергана Никифорова, снимка 2"]);

    const [sold] = await db.select().from(artworks).where(eq(artworks.legacyWpId, 5374));
    expect(sold).toMatchObject({ status: "sold", priceCents: null, framed: true });

    expect((await db.select().from(artists)).map((a) => a.bioBg)).toEqual(["<p>Биография.</p>", "<p>Друга.</p>"]);
    expect(await db.select().from(categories)).toHaveLength(4);
    expect(await db.select().from(reviews)).toHaveLength(1);

    const again = await importLegacyCatalog(db, catalog, { uploadsDir: dir });
    expect(again.artworks).toEqual({ created: 0, updated: 0, skipped: 2 });
    expect(again.images.created).toBe(0);
    expect(await db.select().from(artworks)).toHaveLength(2);
    expect(await db.select().from(reviews)).toHaveLength(1);
  });
});
