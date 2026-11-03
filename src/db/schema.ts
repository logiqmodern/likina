/**
 * Database schema — docs/PROMPT.md §5.1.
 *
 * Phase 0: infrastructure tables carried over from reducta-new (admin, content,
 * media, e-mail outbox, consent, rate limits). The shop tables (artists,
 * categories, artworks, orders, payments) come in Phase 1.
 *
 * Conventions:
 * - Money is integer euro cents (`*_cents`), never floats.
 * - Instants are `timestamptz` (stored UTC); business logic runs in Europe/Sofia.
 */
import { sql } from "drizzle-orm";
import {
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
    /** the order the e-mail is about (FK added with the orders table, Phase 1) */
    orderId: uuid("order_id"),
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
