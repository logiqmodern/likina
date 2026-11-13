/**
 * Database schema — docs/PROMPT.md §5.1.
 *
 * Infrastructure tables carried over from reducta-new (admin, content, media,
 * e-mail outbox, consent, rate limits) and the shop tables (artists,
 * categories, artworks, orders, payments — Phase 1).
 *
 * Conventions:
 * - Money is integer euro cents (`*_cents`), never floats.
 * - Instants are `timestamptz` (stored UTC); business logic runs in Europe/Sofia.
 */
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  customType,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ── Enums ────────────────────────────────────────────────

export const inquiryType = pgEnum("inquiry_type", ["custom_icon", "contact", "similar_artwork"]);
export const inquiryStatus = pgEnum("inquiry_status", ["new", "in_progress", "done"]);

// ── Rate limits ──────────────────────────────────────────

/**
 * Fixed-window counters shared by every app instance (serverless-safe).
 * Keys never contain raw personal data (IPs and phones are hashed).
 */
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] }), index("rate_limits_window_idx").on(t.windowStart)],
);

// ── Inquiries, audit, settings ───────────────────────────

export const inquiries = pgTable(
  "inquiries",
  {
    id: id(),
    type: inquiryType("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: inquiryStatus("status").notNull().default("new"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("inquiries_status_idx").on(t.status, t.createdAt)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    diff: jsonb("diff").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_log_entity_idx").on(t.entity, t.entityId, t.createdAt)],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: updatedAt(),
});

// ── Admin users & sessions (Phase 5) ─────────────────────

export const adminRole = pgEnum("admin_role", ["owner", "developer"]);

export const adminUsers = pgTable(
  "admin_users",
  {
    id: id(),
    /** always stored lower-case (enforced by CHECK) */
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    /** argon2id PHC string */
    passwordHash: text("password_hash").notNull(),
    role: adminRole("role").notNull(),
    /** AES-256-GCM "iv:tag:ciphertext" (base64); set while enrolling, active once totp_enabled_at is set */
    totpSecretEnc: text("totp_secret_enc"),
    totpEnabledAt: timestamp("totp_enabled_at", { withTimezone: true }),
    /** last accepted TOTP time step — a code is accepted at most once (replay protection) */
    totpLastStep: integer("totp_last_step"),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("admin_users_email_lower", sql`${t.email} = lower(${t.email})`),
    check("admin_users_failed_attempts", sql`${t.failedAttempts} >= 0`),
  ],
);

/** Server-side sessions: the cookie holds a random token, the database only its sha-256. */
export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: id(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    /** false until the second factor is verified (or not required for the user) */
    mfaVerified: boolean("mfa_verified").notNull().default(false),
    createdAt: createdAt(),
    /** absolute expiry (no extension on activity) */
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    /** sha-256 of the client IP — never the raw address */
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
  },
  (t) => [
    index("admin_sessions_user_idx").on(t.userId),
    index("admin_sessions_expires_idx").on(t.expiresAt),
  ],
);

// ── Content (Phase 5, §10.2.8) ───────────────────────────

export const contentCollection = pgEnum("content_collection", ["faq", "review", "block"]);

/**
 * Every editable piece of site content. `draft` is what the admin edits;
 * `published` is what the site shows (null = not on the site). Values are
 * validated by src/content/schemas.ts before every write.
 */
export const contentItems = pgTable(
  "content_items",
  {
    id: id(),
    collection: contentCollection("collection").notNull(),
    /** item id within the collection, or the block key ("contacts", "hero:home", "seo:/ceni") */
    slug: text("slug").notNull(),
    sortOrder: smallint("sort_order").notNull().default(0),
    draft: jsonb("draft").$type<Record<string, unknown>>().notNull(),
    published: jsonb("published").$type<Record<string, unknown> | null>(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    updatedBy: text("updated_by").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("content_items_collection_slug_uq").on(t.collection, t.slug),
    index("content_items_collection_idx").on(t.collection, t.sortOrder),
  ],
);

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

/**
 * Uploaded images (§10.2.12), stored optimized (WebP, ≤ 2400 px) in the
 * database so they are covered by the database backup and work on any host.
 * Served by /media/[id]; next/image makes the responsive sizes.
 */
export const media = pgTable(
  "media",
  {
    id: id(),
    filename: text("filename").notNull(),
    /** required (accessibility) */
    alt: text("alt").notNull(),
    mime: text("mime").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    bytes: integer("bytes").notNull(),
    data: bytea("data").notNull(),
    /** e.g. "consent: written, 2026-10-12" for before/after photos */
    note: text("note"),
    uploadedBy: text("uploaded_by").notNull(),
    createdAt: createdAt(),
  },
  (t) => [check("media_alt_not_blank", sql`length(trim(${t.alt})) > 0`), index("media_created_idx").on(t.createdAt)],
);

/** One-time invitations for new admin users (the invitee sets their own password). */
export const adminInvites = pgTable(
  "admin_invites",
  {
    id: id(),
    tokenHash: text("token_hash").notNull().unique(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: adminRole("role").notNull(),
    createdBy: text("created_by").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [check("admin_invites_email_lower", sql`${t.email} = lower(${t.email})`)],
);

// ── E-mail (§6) ──────────────────────────────────────────

export const emailKind = pgEnum("email_kind", [
  // to the customer — texts editable in the CMS (email_templates)
  "order_confirmed",
  "order_payment_failed",
  "order_shipped",
  "order_cancelled",
  // to the seller / Tony — fixed texts
  "seller_new_order",
  "seller_payment_failed",
  "seller_inquiry",
  "alert",
  "test",
]);

export const emailStatus = pgEnum("email_status", [
  "queued",
  "sending",
  /** handed to Resend */
  "sent",
  /** no RESEND_API_KEY: rendered and kept in the log only */
  "logged",
  "delivered",
  "bounced",
  "complained",
  /** gave up after the last retry */
  "failed",
  /** no longer relevant when its turn came (e.g. order cancelled) */
  "skipped",
]);

/**
 * Outbox: every e-mail is a row, written in the same transaction as the change
 * that causes it, then delivered (right after the response, by the worker and
 * by the cron route). `dedupe_key` makes enqueueing idempotent (reminders,
 * daily schedule). The rendered subject + text are kept for the admin log.
 */
export const emailMessages = pgTable(
  "email_messages",
  {
    id: id(),
    kind: emailKind("kind").notNull(),
    toAddress: text("to_address").notNull(),
    /** the order the e-mail is about */
    orderId: uuid("order_id").references((): AnyPgColumn => orders.id, { onDelete: "set null" }),
    /** data for rendering, captured when enqueued (e.g. the old time of a moved booking) */
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    dedupeKey: text("dedupe_key").unique(),
    sendAfter: timestamp("send_after", { withTimezone: true }).notNull().defaultNow(),
    status: emailStatus("status").notNull().default("queued"),
    attempts: smallint("attempts").notNull().default(0),
    /** set while a sender holds the row ("sending"); a stale lock is released after 10 min */
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lastError: text("last_error"),
    providerId: text("provider_id"),
    subject: text("subject"),
    textBody: text("text_body"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    /** last status change reported by the Resend webhook */
    eventAt: timestamp("event_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("email_messages_due_idx").on(t.status, t.sendAfter),
    index("email_messages_order_idx").on(t.orderId),
    index("email_messages_created_idx").on(t.createdAt),
    index("email_messages_provider_idx").on(t.providerId),
  ],
);

/** CMS texts of the customer e-mails (structure and design stay in code). */
export const emailTemplates = pgTable("email_templates", {
  kind: emailKind("kind").primaryKey(),
  /** { subject, preheader, heading, intro, closing, … } — see src/emails/texts.ts */
  texts: jsonb("texts").$type<Record<string, string>>().notNull(),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Measurement (§9) ─────────────────────────────────────

/**
 * Proof of cookie consent (GDPR art. 7(1)): what was chosen, when, under which
 * banner version. `consent_id` is the random id in the visitor's cookie; no IP,
 * no user agent, nothing else about the person.
 */
export const consentRecords = pgTable(
  "consent_records",
  {
    id: id(),
    consentId: text("consent_id").notNull(),
    version: smallint("version").notNull(),
    analytics: boolean("analytics").notNull(),
    marketing: boolean("marketing").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("consent_records_consent_idx").on(t.consentId)],
);

/**
 * Shop funnel counters from our own data (§9: "без да зависи от
 * съгласието"): anonymous daily counts per step and source — no cookies, no
 * identifiers. Steps that leave an order row are read from `orders`.
 */
export const funnelCounts = pgTable(
  "funnel_counts",
  {
    day: date("day").notNull(),
    step: text("step").notNull(),
    /** utm_source or "direct" */
    source: text("source").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.step, t.source] })],
);

// ── Catalogue (§5.1) ─────────────────────────────────────

export const artworkKind = pgEnum("artwork_kind", ["original", "print", "custom_sample"]);
export const artworkStatus = pgEnum("artwork_status", ["draft", "available", "reserved", "sold", "hidden"]);

export const artists = pgTable("artists", {
  id: id(),
  slug: text("slug").notNull().unique(),
  slugEn: text("slug_en").notNull().unique(),
  nameBg: text("name_bg").notNull(),
  nameEn: text("name_en").notNull(),
  /** rich text (sanitized HTML) */
  bioBg: text("bio_bg"),
  bioEn: text("bio_en"),
  photoMediaId: uuid("photo_media_id").references(() => media.id, { onDelete: "set null" }),
  sortOrder: smallint("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  /** WooCommerce category slug under "Нашите автори" (template redirects, §11) */
  legacySlug: text("legacy_slug"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const categories = pgTable("categories", {
  id: id(),
  slug: text("slug").notNull().unique(),
  slugEn: text("slug_en").notNull().unique(),
  nameBg: text("name_bg").notNull(),
  nameEn: text("name_en").notNull(),
  descriptionBg: text("description_bg"),
  descriptionEn: text("description_en"),
  parentId: uuid("parent_id").references((): AnyPgColumn => categories.id, { onDelete: "set null" }),
  imageMediaId: uuid("image_media_id").references(() => media.id, { onDelete: "set null" }),
  sortOrder: smallint("sort_order").notNull().default(0),
  seoTitleBg: text("seo_title_bg"),
  seoTitleEn: text("seo_title_en"),
  seoDescriptionBg: text("seo_description_bg"),
  seoDescriptionEn: text("seo_description_en"),
  /** old WooCommerce product_cat slugs that map here (template redirects, §11) */
  legacySlugs: text("legacy_slugs").array().notNull().default(sql`'{}'::text[]`),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/**
 * One artwork for sale (§5.1). Money in euro cents; sizes in millimetres
 * (integers, shown as cm). An original always has stock 1.
 */
export const artworks = pgTable(
  "artworks",
  {
    id: id(),
    kind: artworkKind("kind").notNull().default("original"),
    status: artworkStatus("status").notNull().default("draft"),
    slug: text("slug").notNull().unique(),
    slugEn: text("slug_en").notNull().unique(),
    titleBg: text("title_bg").notNull(),
    titleEn: text("title_en"),
    artistId: uuid("artist_id").references(() => artists.id, { onDelete: "restrict" }),
    techniqueBg: text("technique_bg"),
    techniqueEn: text("technique_en"),
    materialsBg: text("materials_bg"),
    materialsEn: text("materials_en"),
    year: smallint("year"),
    widthMm: integer("width_mm"),
    heightMm: integer("height_mm"),
    depthMm: integer("depth_mm"),
    /** null = unknown */
    framed: boolean("framed"),
    /** the size came from the old text and still has to be confirmed by the client (§15) */
    sizeNeedsCheck: boolean("size_needs_check").notNull().default(false),
    /** the old free-text size line, kept for the check */
    sizeNote: text("size_note"),
    packageWeightG: integer("package_weight_g"),
    packageDimsMm: jsonb("package_dims_mm").$type<{ l: number; w: number; h: number }>(),
    /** null = no price: not purchasable ("по запитване") */
    priceCents: integer("price_cents"),
    compareAtCents: integer("compare_at_cents"),
    badges: text("badges").array().notNull().default(sql`'{}'::text[]`),
    /** rich text (sanitized HTML) */
    descriptionBg: text("description_bg"),
    descriptionEn: text("description_en"),
    storyBg: text("story_bg"),
    storyEn: text("story_en"),
    stock: integer("stock").notNull().default(1),
    editionSize: integer("edition_size"),
    editionNumber: integer("edition_number"),
    /** null = the shop setting (2–3 working days) */
    shipsInDays: smallint("ships_in_days"),
    seoTitleBg: text("seo_title_bg"),
    seoTitleEn: text("seo_title_en"),
    seoDescriptionBg: text("seo_description_bg"),
    seoDescriptionEn: text("seo_description_en"),
    /** per EN field: hash of the BG text it was translated from, and whether it was fixed by hand (§7) */
    translationMeta: jsonb("translation_meta")
      .$type<Record<string, { sourceHash: string; locked: boolean }>>()
      .notNull()
      .default({}),
    legacyWpId: integer("legacy_wp_id").unique(),
    /** decoded WooCommerce slug, for the /product/{slug} redirect (§11) */
    legacySlug: text("legacy_slug"),
    sortOrder: integer("sort_order").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    soldAt: timestamp("sold_at", { withTimezone: true }),
    /** "продадена извън сайта" — sold at an exhibition, in the atelier or elsewhere */
    soldOffline: boolean("sold_offline").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("artworks_status_idx").on(t.status, t.publishedAt),
    index("artworks_artist_idx").on(t.artistId),
    index("artworks_legacy_slug_idx").on(t.legacySlug),
    check("artworks_price_nonneg", sql`${t.priceCents} IS NULL OR ${t.priceCents} >= 0`),
    check("artworks_compare_nonneg", sql`${t.compareAtCents} IS NULL OR ${t.compareAtCents} >= 0`),
    check("artworks_stock_nonneg", sql`${t.stock} >= 0`),
    check("artworks_original_stock", sql`${t.kind} <> 'original' OR ${t.stock} <= 1`),
    check("artworks_sizes_pos", sql`coalesce(${t.widthMm}, 1) > 0 AND coalesce(${t.heightMm}, 1) > 0 AND coalesce(${t.depthMm}, 1) > 0`),
  ],
);

export const artworkCategories = pgTable(
  "artwork_categories",
  {
    artworkId: uuid("artwork_id")
      .notNull()
      .references(() => artworks.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.artworkId, t.categoryId] }), index("artwork_categories_category_idx").on(t.categoryId)],
);

/** Ordered photos of an artwork; alt text is required in both languages (§13). */
export const artworkImages = pgTable(
  "artwork_images",
  {
    id: id(),
    artworkId: uuid("artwork_id")
      .notNull()
      .references(() => artworks.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => media.id, { onDelete: "restrict" }),
    sortOrder: smallint("sort_order").notNull().default(0),
    altBg: text("alt_bg").notNull(),
    altEn: text("alt_en"),
    /** WordPress attachment id (idempotent import) */
    legacyWpId: integer("legacy_wp_id"),
    createdAt: createdAt(),
  },
  (t) => [
    index("artwork_images_artwork_idx").on(t.artworkId, t.sortOrder),
    unique("artwork_images_artwork_media_uq").on(t.artworkId, t.mediaId),
    check("artwork_images_alt_not_blank", sql`length(trim(${t.altBg})) > 0`),
  ],
);

/** Every price change (Omnibus "lowest price in the last 30 days", §5.4). */
export const priceHistory = pgTable(
  "price_history",
  {
    id: id(),
    artworkId: uuid("artwork_id")
      .notNull()
      .references(() => artworks.id, { onDelete: "cascade" }),
    priceCents: integer("price_cents"),
    compareAtCents: integer("compare_at_cents"),
    changedBy: text("changed_by").notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("price_history_artwork_idx").on(t.artworkId, t.changedAt)],
);

/** Customer reviews shown on the site (§4.1: text and name only). */
export const reviews = pgTable("reviews", {
  id: id(),
  textBg: text("text_bg"),
  textEn: text("text_en"),
  authorName: text("author_name").notNull(),
  sortOrder: smallint("sort_order").notNull().default(0),
  isPublished: boolean("is_published").notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ── Orders (§5.1–5.3) ────────────────────────────────────

export const orderStatus = pgEnum("order_status", [
  /** card payment started; the artworks are reserved until expires_at */
  "pending_payment",
  "paid",
  /** pay later — cash on delivery or at the atelier; the artworks are sold */
  "confirmed",
  "shipped",
  "delivered",
  "completed",
  "payment_failed",
  "cancelled",
  "returned",
  "refunded",
]);
export const deliveryMethod = pgEnum("delivery_method", ["econt_office", "econt_address", "econt_locker", "pickup"]);
export const paymentMethod = pgEnum("payment_method", ["mypos", "cod", "on_pickup"]);
export const locale = pgEnum("locale", ["bg", "en"]);

export interface DeliveryDetails {
  city?: string;
  postCode?: string;
  /** Econt office / locker code and its name, or free text when the Econt list was unavailable */
  officeCode?: string;
  officeName?: string;
  address?: string;
}

export interface InvoiceDetails {
  company: string;
  eik: string;
  vatNumber?: string;
  mol: string;
  address: string;
}

export const orders = pgTable(
  "orders",
  {
    id: id(),
    /** LK-2026-0001 */
    number: text("number").notNull().unique(),
    status: orderStatus("status").notNull(),
    locale: locale("locale").notNull().default("bg"),
    customerName: text("customer_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    deliveryMethod: deliveryMethod("delivery_method").notNull(),
    delivery: jsonb("delivery").$type<DeliveryDetails>().notNull().default({}),
    paymentMethod: paymentMethod("payment_method").notNull(),
    subtotalCents: integer("subtotal_cents").notNull(),
    discountCents: integer("discount_cents").notNull().default(0),
    /** 0 while shipping is included in the price (§6.3) */
    shippingCents: integer("shipping_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    /** the pricing inputs at checkout (discount percent, shipping model) */
    pricingSnapshot: jsonb("pricing_snapshot").$type<Record<string, unknown>>().notNull(),
    invoice: jsonb("invoice").$type<InvoiceDetails>(),
    notesClient: text("notes_client"),
    notesInternal: text("notes_internal"),
    marketingConsent: boolean("marketing_consent").notNull().default(false),
    termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }).notNull(),
    /** utm_*, gclid, fbclid, landing page, referrer */
    attribution: jsonb("attribution").$type<Record<string, string>>().notNull().default({}),
    /** sha-256 of the order link token (≥ 32 random bytes, §14) */
    manageTokenHash: text("manage_token_hash").notNull().unique(),
    /** end of the card-payment reservation (pending_payment only) */
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    econtShipmentNumber: text("econt_shipment_number"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [
    index("orders_status_idx").on(t.status, t.createdAt),
    index("orders_expires_idx").on(t.expiresAt),
    index("orders_email_idx").on(t.email),
    check(
      "orders_totals",
      sql`${t.totalCents} = ${t.subtotalCents} - ${t.discountCents} + ${t.shippingCents} AND ${t.totalCents} >= 0`,
    ),
    check("orders_cod_not_pickup", sql`NOT (${t.paymentMethod} = 'cod' AND ${t.deliveryMethod} = 'pickup')`),
    check("orders_on_pickup_is_pickup", sql`${t.paymentMethod} <> 'on_pickup' OR ${t.deliveryMethod} = 'pickup'`),
  ],
);

/** Year-based order counters (LK-2026-0001). */
export const orderCounters = pgTable("order_counters", {
  year: smallint("year").primaryKey(),
  last: integer("last").notNull(),
});

/**
 * Items, with the artwork as it was when ordered (snapshot, §5.4).
 * `holds_stock` is true while the order is active; together with the partial
 * unique index it makes it impossible for one original to be in two active
 * orders (§5.3) — even if the application logic had a bug.
 */
export const orderItems = pgTable(
  "order_items",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    artworkId: uuid("artwork_id")
      .notNull()
      .references(() => artworks.id, { onDelete: "restrict" }),
    kind: artworkKind("kind").notNull(),
    titleBg: text("title_bg").notNull(),
    titleEn: text("title_en"),
    artistName: text("artist_name"),
    imageMediaId: uuid("image_media_id"),
    qty: integer("qty").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    lineTotalCents: integer("line_total_cents").notNull(),
    holdsStock: boolean("holds_stock").notNull().default(true),
  },
  (t) => [
    index("order_items_order_idx").on(t.orderId),
    index("order_items_artwork_idx").on(t.artworkId),
    uniqueIndex("order_items_one_active_original_uq")
      .on(t.artworkId)
      .where(sql`${t.kind} = 'original' AND ${t.holdsStock}`),
    check("order_items_qty", sql`${t.qty} >= 1 AND (${t.kind} <> 'original' OR ${t.qty} = 1)`),
    check("order_items_total", sql`${t.lineTotalCents} = ${t.unitPriceCents} * ${t.qty}`),
  ],
);

export const paymentProvider = pgEnum("payment_provider", ["mypos", "cash", "manual"]);
export const paymentKind = pgEnum("payment_kind", ["payment", "refund"]);
export const paymentResult = pgEnum("payment_result", ["succeeded", "failed", "cancelled"]);

/**
 * Append-only payment log (§5.1): every notification and manual entry.
 * The unique key makes repeated myPOS notifications idempotent.
 */
export const payments = pgTable(
  "payments",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    provider: paymentProvider("provider").notNull(),
    kind: paymentKind("kind").notNull().default("payment"),
    providerRef: text("provider_ref").notNull(),
    amountCents: integer("amount_cents").notNull(),
    result: paymentResult("result").notNull(),
    note: text("note"),
    raw: jsonb("raw").$type<Record<string, unknown>>(),
    createdBy: text("created_by").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique("payments_provider_ref_uq").on(t.provider, t.kind, t.providerRef),
    index("payments_order_idx").on(t.orderId, t.createdAt),
    check("payments_amount_nonneg", sql`${t.amountCents} >= 0`),
  ],
);
