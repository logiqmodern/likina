// One-off export of the old likina.com (WordPress/WooCommerce) before the
// Superhosting account expires. Public endpoints only (no credentials):
// Store API products + categories, WP pages/posts, every product image, and
// the BG + EN HTML of each product page (TranslatePress renders EN as HTML).
// Usage: node scripts/legacy/export-woocommerce.mjs <outDir>
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const BASE = "https://likina.com";
const out = process.argv[2] ?? "legacy-export";
const UA = { "user-agent": "likina-migration-export/1.0" };

async function get(url, as = "json") {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return as === "json"
        ? { data: await r.json(), headers: r.headers }
        : as === "text"
          ? await r.text()
          : Buffer.from(await r.arrayBuffer());
    } catch (e) {
      if (attempt === 4) throw e;
      await new Promise((res) => setTimeout(res, 1500 * attempt));
    }
  }
}

async function paged(path) {
  const all = [];
  for (let page = 1; page < 50; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const { data, headers } = await get(
      `${BASE}${path}${sep}per_page=100&page=${page}`,
    );
    all.push(...data);
    const total = Number(headers.get("x-wp-totalpages") ?? 1);
    if (page >= total || data.length === 0) break;
  }
  return all;
}

await mkdir(join(out, "images"), { recursive: true });
await mkdir(join(out, "html", "bg"), { recursive: true });
await mkdir(join(out, "html", "en"), { recursive: true });

const products = await paged("/wp-json/wc/store/v1/products");
const categories = await paged("/wp-json/wc/store/v1/products/categories");
const pages = await paged(
  "/wp-json/wp/v2/pages?_fields=id,slug,link,title,content,status",
);
const posts = await paged(
  "/wp-json/wp/v2/posts?_fields=id,slug,link,title,content,date",
);
await writeFile(join(out, "products.json"), JSON.stringify(products, null, 2));
await writeFile(
  join(out, "categories.json"),
  JSON.stringify(categories, null, 2),
);
await writeFile(join(out, "pages.json"), JSON.stringify(pages, null, 2));
await writeFile(join(out, "posts.json"), JSON.stringify(posts, null, 2));
console.log(
  `products ${products.length}, categories ${categories.length}, pages ${pages.length}, posts ${posts.length}`,
);

const images = new Map();
for (const p of products)
  for (const img of p.images ?? []) images.set(img.id, img.src);
for (const c of categories)
  if (c.image?.src) images.set(c.image.id, c.image.src);
let saved = 0;
const failed = [];
for (const [id, src] of images) {
  try {
    const name = `${id}-${decodeURIComponent(src.split("/").pop() ?? "img").replace(/[^\w.\-]+/g, "_")}`;
    await writeFile(join(out, "images", name), await get(src, "buf"));
    saved++;
  } catch (e) {
    failed.push(`${id} ${src} ${e.message}`);
  }
}
console.log(`images ${saved}/${images.size}`);

for (const p of products) {
  for (const [lang, url] of [
    ["bg", p.permalink],
    ["en", p.permalink.replace(BASE + "/", BASE + "/en/")],
  ]) {
    try {
      await writeFile(
        join(out, "html", lang, `${p.id}.html`),
        await get(url, "text"),
      );
    } catch (e) {
      failed.push(`${lang} ${p.id} ${e.message}`);
    }
  }
}
for (const path of [
  "/",
  "/en/",
  "/about/",
  "/en/about/",
  "/contact/",
  "/en/contact/",
  "/privacy-policy/",
  "/privacy-policy-2/",
  "/shipping-returns/",
  "/faq/",
]) {
  try {
    await writeFile(
      join(out, "html", `${path.replace(/\//g, "_") || "_root"}.html`),
      await get(BASE + path, "text"),
    );
  } catch (e) {
    failed.push(`${path} ${e.message}`);
  }
}
await writeFile(join(out, "failed.txt"), failed.join("\n"));
console.log(`failed ${failed.length}`);
