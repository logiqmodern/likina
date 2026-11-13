#!/usr/bin/env python3
"""
Extracts the public catalogue of the old likina.com (WordPress/WooCommerce)
from the cPanel MySQL dump, loaded into a local MariaDB database.

    mariadb -e "CREATE DATABASE legacy CHARACTER SET utf8mb4"
    mariadb legacy < likinaco_cd8.sql
    python3 scripts/legacy/extract-dump.py > data/legacy/catalog.json

Output: products (published + drafts), product categories, the 7 reviews and
the About page text. No orders, customers or users — those stay in the
backup only (spec §15.3). Cleaning happens in the TypeScript importer.
"""
import json, re, sys, html
from urllib.parse import unquote
import pymysql

DB = dict(unix_socket="/run/mysqld/mysqld.sock", user="root", db="legacy", charset="utf8mb4")
c = pymysql.connect(**DB)
cur = c.cursor(pymysql.cursors.DictCursor)

def meta(pid):
    cur.execute("SELECT meta_key, meta_value FROM cd8postmeta WHERE post_id=%s", (pid,))
    return {r["meta_key"]: r["meta_value"] for r in cur.fetchall()}

def attachment(aid):
    if not aid:
        return None
    m = meta(aid)
    if not m.get("_wp_attached_file"):
        return None
    cur.execute("SELECT post_title FROM cd8posts WHERE ID=%s", (aid,))
    row = cur.fetchone() or {}
    return {"id": int(aid), "file": m["_wp_attached_file"], "alt": (m.get("_wp_attachment_image_alt") or "").strip(), "title": row.get("post_title") or ""}

def iso(d):
    # drafts have "0000-00-00 00:00:00", which the driver returns as a string
    return d.isoformat() + "Z" if hasattr(d, "isoformat") else None

def money(v):
    if v is None or str(v).strip() == "":
        return None
    return round(float(v) * 100)

cur.execute("""SELECT ID, post_status, post_title, post_name, post_content, post_excerpt, post_date_gmt, menu_order
               FROM cd8posts WHERE post_type='product' AND post_status IN ('publish','draft') ORDER BY ID""")
products = []
for p in cur.fetchall():
    m = meta(p["ID"])
    cur.execute("""SELECT t.slug, tt.taxonomy FROM cd8term_relationships tr
                   JOIN cd8term_taxonomy tt USING(term_taxonomy_id) JOIN cd8terms t USING(term_id)
                   WHERE tr.object_id=%s""", (p["ID"],))
    terms = cur.fetchall()
    ids = []
    if m.get("_thumbnail_id"):
        ids.append(int(m["_thumbnail_id"]))
    for g in (m.get("_product_image_gallery") or "").split(","):
        if g.strip() and int(g) not in ids:
            ids.append(int(g))
    products.append({
        "wpId": p["ID"],
        "status": p["post_status"],
        "title": html.unescape(p["post_title"]).strip(),
        "slug": unquote(p["post_name"] or ""),
        "excerpt": p["post_excerpt"] or "",
        "content": p["post_content"] or "",
        "dateGmt": iso(p["post_date_gmt"]),
        "menuOrder": p["menu_order"],
        "priceCents": money(m.get("_price")),
        "regularCents": money(m.get("_regular_price")),
        "saleCents": money(m.get("_sale_price")),
        "stockStatus": m.get("_stock_status"),
        "categories": sorted(t["slug"] for t in terms if t["taxonomy"] == "product_cat"),
        "images": [a for a in (attachment(i) for i in ids) if a],
    })

cur.execute("""SELECT t.term_id, t.name, t.slug, tt.description, tt.parent,
                      (SELECT meta_value FROM cd8termmeta WHERE term_id=t.term_id AND meta_key='thumbnail_id') thumb
               FROM cd8terms t JOIN cd8term_taxonomy tt USING(term_id) WHERE tt.taxonomy='product_cat' ORDER BY t.term_id""")
categories = []
for t in cur.fetchall():
    categories.append({"wpId": t["term_id"], "name": html.unescape(t["name"]), "slug": t["slug"], "description": t["description"],
                       "parentWpId": t["parent"] or None, "image": attachment(t["thumb"]) if t["thumb"] and t["thumb"] != "0" else None})

# The 7 reviews: testimonial carousel on the front page (Elementor data). Text + name only (§4.1).
cur.execute("SELECT option_value FROM cd8options WHERE option_name='page_on_front'")
front = int(cur.fetchone()["option_value"])
cur.execute("SELECT meta_value FROM cd8postmeta WHERE post_id=%s AND meta_key='_elementor_data'", (front,))
reviews = []
def walk(n):
    if isinstance(n, dict):
        if n.get("widgetType") == "testimonial-carousel":
            for s in n.get("settings", {}).get("slides", []):
                text = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s.get("content", "")))).strip()
                name = (s.get("name") or "").strip()
                # the quote sometimes repeats the name at the end: "…" Peter
                text = re.sub(r'^"(.*)"\s*' + re.escape(name) + r"$", r"\1", text).strip().strip('"').strip()
                reviews.append({"name": name, "text": text})
        for v in n.values():
            walk(v)
    elif isinstance(n, list):
        for v in n:
            walk(v)
walk(json.loads(cur.fetchone()["meta_value"]))

cur.execute("SELECT post_content FROM cd8posts WHERE post_type='page' AND post_name='about' AND post_status='publish'")
about = cur.fetchone()["post_content"]

json.dump({"source": "cPanel backup of likina.com (MariaDB dump likinaco_cd8.sql)", "products": products,
           "categories": categories, "reviews": reviews, "aboutHtml": about}, sys.stdout, ensure_ascii=False, indent=1)
