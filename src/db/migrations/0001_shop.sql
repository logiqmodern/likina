CREATE TYPE "public"."artwork_kind" AS ENUM('original', 'print', 'custom_sample');--> statement-breakpoint
CREATE TYPE "public"."artwork_status" AS ENUM('draft', 'available', 'reserved', 'sold', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."delivery_method" AS ENUM('econt_office', 'econt_address', 'econt_locker', 'pickup');--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('bg', 'en');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending_payment', 'paid', 'confirmed', 'shipped', 'delivered', 'completed', 'payment_failed', 'cancelled', 'returned', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."payment_kind" AS ENUM('payment', 'refund');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('mypos', 'cod', 'on_pickup');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('mypos', 'cash', 'manual');--> statement-breakpoint
CREATE TYPE "public"."payment_result" AS ENUM('succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "artists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"slug_en" text NOT NULL,
	"name_bg" text NOT NULL,
	"name_en" text NOT NULL,
	"bio_bg" text,
	"bio_en" text,
	"photo_media_id" uuid,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"legacy_slug" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artists_slug_unique" UNIQUE("slug"),
	CONSTRAINT "artists_slug_en_unique" UNIQUE("slug_en")
);
--> statement-breakpoint
CREATE TABLE "artwork_categories" (
	"artwork_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	CONSTRAINT "artwork_categories_artwork_id_category_id_pk" PRIMARY KEY("artwork_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "artwork_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artwork_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"alt_bg" text NOT NULL,
	"alt_en" text,
	"legacy_wp_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artwork_images_artwork_media_uq" UNIQUE("artwork_id","media_id"),
	CONSTRAINT "artwork_images_alt_not_blank" CHECK (length(trim("artwork_images"."alt_bg")) > 0)
);
--> statement-breakpoint
CREATE TABLE "artworks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "artwork_kind" DEFAULT 'original' NOT NULL,
	"status" "artwork_status" DEFAULT 'draft' NOT NULL,
	"slug" text NOT NULL,
	"slug_en" text NOT NULL,
	"title_bg" text NOT NULL,
	"title_en" text,
	"artist_id" uuid,
	"technique_bg" text,
	"technique_en" text,
	"materials_bg" text,
	"materials_en" text,
	"year" smallint,
	"width_mm" integer,
	"height_mm" integer,
	"depth_mm" integer,
	"framed" boolean,
	"size_needs_check" boolean DEFAULT false NOT NULL,
	"size_note" text,
	"package_weight_g" integer,
	"package_dims_mm" jsonb,
	"price_cents" integer,
	"compare_at_cents" integer,
	"badges" text[] DEFAULT '{}'::text[] NOT NULL,
	"description_bg" text,
	"description_en" text,
	"story_bg" text,
	"story_en" text,
	"stock" integer DEFAULT 1 NOT NULL,
	"edition_size" integer,
	"edition_number" integer,
	"ships_in_days" smallint,
	"seo_title_bg" text,
	"seo_title_en" text,
	"seo_description_bg" text,
	"seo_description_en" text,
	"translation_meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"legacy_wp_id" integer,
	"legacy_slug" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"sold_at" timestamp with time zone,
	"sold_offline" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "artworks_slug_unique" UNIQUE("slug"),
	CONSTRAINT "artworks_slug_en_unique" UNIQUE("slug_en"),
	CONSTRAINT "artworks_legacy_wp_id_unique" UNIQUE("legacy_wp_id"),
	CONSTRAINT "artworks_price_nonneg" CHECK ("artworks"."price_cents" IS NULL OR "artworks"."price_cents" >= 0),
	CONSTRAINT "artworks_compare_nonneg" CHECK ("artworks"."compare_at_cents" IS NULL OR "artworks"."compare_at_cents" >= 0),
	CONSTRAINT "artworks_stock_nonneg" CHECK ("artworks"."stock" >= 0),
	CONSTRAINT "artworks_original_stock" CHECK ("artworks"."kind" <> 'original' OR "artworks"."stock" <= 1),
	CONSTRAINT "artworks_sizes_pos" CHECK (coalesce("artworks"."width_mm", 1) > 0 AND coalesce("artworks"."height_mm", 1) > 0 AND coalesce("artworks"."depth_mm", 1) > 0)
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"slug_en" text NOT NULL,
	"name_bg" text NOT NULL,
	"name_en" text NOT NULL,
	"description_bg" text,
	"description_en" text,
	"parent_id" uuid,
	"image_media_id" uuid,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"seo_title_bg" text,
	"seo_title_en" text,
	"seo_description_bg" text,
	"seo_description_en" text,
	"legacy_slugs" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug"),
	CONSTRAINT "categories_slug_en_unique" UNIQUE("slug_en")
);
--> statement-breakpoint
CREATE TABLE "order_counters" (
	"year" smallint PRIMARY KEY NOT NULL,
	"last" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"artwork_id" uuid NOT NULL,
	"kind" "artwork_kind" NOT NULL,
	"title_bg" text NOT NULL,
	"title_en" text,
	"artist_name" text,
	"image_media_id" uuid,
	"qty" integer NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"line_total_cents" integer NOT NULL,
	"holds_stock" boolean DEFAULT true NOT NULL,
	CONSTRAINT "order_items_qty" CHECK ("order_items"."qty" >= 1 AND ("order_items"."kind" <> 'original' OR "order_items"."qty" = 1)),
	CONSTRAINT "order_items_total" CHECK ("order_items"."line_total_cents" = "order_items"."unit_price_cents" * "order_items"."qty")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"status" "order_status" NOT NULL,
	"locale" "locale" DEFAULT 'bg' NOT NULL,
	"customer_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"delivery_method" "delivery_method" NOT NULL,
	"delivery" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"subtotal_cents" integer NOT NULL,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"shipping_cents" integer DEFAULT 0 NOT NULL,
	"total_cents" integer NOT NULL,
	"pricing_snapshot" jsonb NOT NULL,
	"invoice" jsonb,
	"notes_client" text,
	"notes_internal" text,
	"marketing_consent" boolean DEFAULT false NOT NULL,
	"terms_accepted_at" timestamp with time zone NOT NULL,
	"attribution" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"manage_token_hash" text NOT NULL,
	"expires_at" timestamp with time zone,
	"econt_shipment_number" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	CONSTRAINT "orders_number_unique" UNIQUE("number"),
	CONSTRAINT "orders_manage_token_hash_unique" UNIQUE("manage_token_hash"),
	CONSTRAINT "orders_totals" CHECK ("orders"."total_cents" = "orders"."subtotal_cents" - "orders"."discount_cents" + "orders"."shipping_cents" AND "orders"."total_cents" >= 0),
	CONSTRAINT "orders_cod_not_pickup" CHECK (NOT ("orders"."payment_method" = 'cod' AND "orders"."delivery_method" = 'pickup')),
	CONSTRAINT "orders_on_pickup_is_pickup" CHECK ("orders"."payment_method" <> 'on_pickup' OR "orders"."delivery_method" = 'pickup')
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"kind" "payment_kind" DEFAULT 'payment' NOT NULL,
	"provider_ref" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"result" "payment_result" NOT NULL,
	"note" text,
	"raw" jsonb,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_provider_ref_uq" UNIQUE("provider","kind","provider_ref"),
	CONSTRAINT "payments_amount_nonneg" CHECK ("payments"."amount_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "price_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artwork_id" uuid NOT NULL,
	"price_cents" integer,
	"compare_at_cents" integer,
	"changed_by" text NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text_bg" text,
	"text_en" text,
	"author_name" text NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "artists" ADD CONSTRAINT "artists_photo_media_id_media_id_fk" FOREIGN KEY ("photo_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artwork_categories" ADD CONSTRAINT "artwork_categories_artwork_id_artworks_id_fk" FOREIGN KEY ("artwork_id") REFERENCES "public"."artworks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artwork_categories" ADD CONSTRAINT "artwork_categories_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artwork_images" ADD CONSTRAINT "artwork_images_artwork_id_artworks_id_fk" FOREIGN KEY ("artwork_id") REFERENCES "public"."artworks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artwork_images" ADD CONSTRAINT "artwork_images_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artworks" ADD CONSTRAINT "artworks_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_image_media_id_media_id_fk" FOREIGN KEY ("image_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_artwork_id_artworks_id_fk" FOREIGN KEY ("artwork_id") REFERENCES "public"."artworks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_artwork_id_artworks_id_fk" FOREIGN KEY ("artwork_id") REFERENCES "public"."artworks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artwork_categories_category_idx" ON "artwork_categories" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "artwork_images_artwork_idx" ON "artwork_images" USING btree ("artwork_id","sort_order");--> statement-breakpoint
CREATE INDEX "artworks_status_idx" ON "artworks" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "artworks_artist_idx" ON "artworks" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "artworks_legacy_slug_idx" ON "artworks" USING btree ("legacy_slug");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_artwork_idx" ON "order_items" USING btree ("artwork_id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_items_one_active_original_uq" ON "order_items" USING btree ("artwork_id") WHERE "order_items"."kind" = 'original' AND "order_items"."holds_stock";--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "orders_expires_idx" ON "orders" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "orders_email_idx" ON "orders" USING btree ("email");--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "price_history_artwork_idx" ON "price_history" USING btree ("artwork_id","changed_at");--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;