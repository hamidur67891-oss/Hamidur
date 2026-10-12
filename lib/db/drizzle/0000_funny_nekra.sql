CREATE TYPE "public"."application_status" AS ENUM('pending', 'approved', 'rejected', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."shop_status" AS ENUM('pending', 'approved', 'rejected', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('customer', 'seller', 'admin');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."product_moderation_status" AS ENUM('visible', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."complaint_status" AS ENUM('open', 'reviewing', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'verified', 'failed');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('pending', 'active', 'expired', 'cancelled');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name"),
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "pincodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"pin_code" varchar(6) NOT NULL,
	"area_name" varchar(120) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pincodes_pin_code_unique" UNIQUE("pin_code"),
	CONSTRAINT "pincodes_pin_code_six_digits" CHECK ("pincodes"."pin_code" ~ '^[0-9]{6}$')
);
--> statement-breakpoint
CREATE TABLE "shop_applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"owner_name" varchar(120) NOT NULL,
	"category_id" integer,
	"category_name" varchar(80) NOT NULL,
	"address" varchar(500) NOT NULL,
	"pin_code" varchar(6) NOT NULL,
	"contact_phone" varchar(16) NOT NULL,
	"whatsapp_number" varchar(16) NOT NULL,
	"status" "application_status" DEFAULT 'pending' NOT NULL,
	"rejection_reason" varchar(1000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shop_applications_pin_code_six_digits" CHECK ("shop_applications"."pin_code" ~ '^[0-9]{6}$')
);
--> statement-breakpoint
CREATE TABLE "shops" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" integer NOT NULL,
	"application_id" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"owner_name" varchar(120) NOT NULL,
	"category_id" integer NOT NULL,
	"description" varchar(2000),
	"address" varchar(500) NOT NULL,
	"pin_code" varchar(6) NOT NULL,
	"pin_code_verified" boolean DEFAULT false NOT NULL,
	"contact_phone" varchar(16) NOT NULL,
	"whatsapp_number" varchar(16) NOT NULL,
	"image_url" varchar(500),
	"status" "shop_status" DEFAULT 'pending' NOT NULL,
	"rejection_reason" varchar(1000),
	"profile_views" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shops_owner_id_unique" UNIQUE("owner_id"),
	CONSTRAINT "shops_application_id_unique" UNIQUE("application_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"phone" varchar(16),
	"pin_code" varchar(6),
	"role" "user_role" DEFAULT 'customer' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_user_id_unique" UNIQUE("clerk_user_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_pin_code_six_digits" CHECK ("users"."pin_code" IS NULL OR "users"."pin_code" ~ '^[0-9]{6}$')
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"object_path" text NOT NULL,
	"alt_text" varchar(300),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"viewer_id" integer,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"category_id" integer NOT NULL,
	"description" varchar(2000),
	"price_paise" integer NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"image_url" varchar(500),
	"is_featured" boolean DEFAULT false NOT NULL,
	"moderation_status" "product_moderation_status" DEFAULT 'visible' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_price_nonnegative" CHECK ("products"."price_paise" >= 0)
);
--> statement-breakpoint
CREATE TABLE "complaints" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"shop_id" integer,
	"product_id" integer,
	"subject" varchar(160) NOT NULL,
	"details" text NOT NULL,
	"status" "complaint_status" DEFAULT 'open' NOT NULL,
	"admin_note" varchar(2000),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"product_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"sender_id" integer NOT NULL,
	"body" varchar(2000) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" varchar(160) NOT NULL,
	"body" varchar(2000) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"subscription_id" integer NOT NULL,
	"amount_inr_paise" integer NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"provider" text NOT NULL,
	"reference" text,
	"provider_event_id" text,
	"test_token_hash" text,
	"test_token_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"verified_at" timestamp with time zone,
	CONSTRAINT "payments_provider_event_id_unique" UNIQUE("provider_event_id"),
	CONSTRAINT "payments_amount_nonnegative" CHECK ("payments"."amount_inr_paise" >= 0)
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" integer NOT NULL,
	"status" "subscription_status" DEFAULT 'pending' NOT NULL,
	"amount_inr_paise" integer NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"starts_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"renewal_reminder_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_amount_nonnegative" CHECK ("subscriptions"."amount_inr_paise" >= 0)
);
--> statement-breakpoint
ALTER TABLE "shop_applications" ADD CONSTRAINT "shop_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_applications" ADD CONSTRAINT "shop_applications_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shop_applications" ADD CONSTRAINT "shop_applications_pin_code_pincodes_pin_code_fk" FOREIGN KEY ("pin_code") REFERENCES "public"."pincodes"("pin_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shops" ADD CONSTRAINT "shops_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shops" ADD CONSTRAINT "shops_application_id_shop_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."shop_applications"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shops" ADD CONSTRAINT "shops_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shops" ADD CONSTRAINT "shops_pin_code_pincodes_pin_code_fk" FOREIGN KEY ("pin_code") REFERENCES "public"."pincodes"("pin_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_views" ADD CONSTRAINT "product_views_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_views" ADD CONSTRAINT "product_views_viewer_id_users_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "categories_active_idx" ON "categories" USING btree ("active");--> statement-breakpoint
CREATE INDEX "pincodes_active_idx" ON "pincodes" USING btree ("active");--> statement-breakpoint
CREATE INDEX "shop_applications_user_idx" ON "shop_applications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "shop_applications_status_created_idx" ON "shop_applications" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_applications_one_pending_per_user" ON "shop_applications" USING btree ("user_id") WHERE "shop_applications"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "shops_pin_status_verified_idx" ON "shops" USING btree ("pin_code","status","pin_code_verified");--> statement-breakpoint
CREATE INDEX "shops_category_idx" ON "shops" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "shops_owner_idx" ON "shops" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "product_images_product_idx" ON "product_images" USING btree ("product_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "product_images_product_object_unique" ON "product_images" USING btree ("product_id","object_path");--> statement-breakpoint
CREATE INDEX "product_views_product_date_idx" ON "product_views" USING btree ("product_id","viewed_at");--> statement-breakpoint
CREATE INDEX "products_shop_idx" ON "products" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "products_moderation_available_idx" ON "products" USING btree ("moderation_status","available");--> statement-breakpoint
CREATE INDEX "complaints_status_date_idx" ON "complaints" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "complaints_user_idx" ON "complaints" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "conversations_shop_idx" ON "conversations" USING btree ("shop_id","updated_at");--> statement-breakpoint
CREATE INDEX "conversations_customer_idx" ON "conversations" USING btree ("customer_id","updated_at");--> statement-breakpoint
CREATE INDEX "conversations_product_idx" ON "conversations" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_unique_general_shop_customer" ON "conversations" USING btree ("shop_id","customer_id") WHERE "conversations"."product_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_unique_product_shop_customer" ON "conversations" USING btree ("shop_id","customer_id","product_id") WHERE "conversations"."product_id" is not null;--> statement-breakpoint
CREATE INDEX "messages_conversation_date_idx" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_unread_idx" ON "messages" USING btree ("conversation_id","read_at");--> statement-breakpoint
CREATE INDEX "notifications_user_date_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "payments_subscription_date_idx" ON "payments" USING btree ("subscription_id","created_at");--> statement-breakpoint
CREATE INDEX "payments_status_date_idx" ON "payments" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "subscriptions_shop_created_idx" ON "subscriptions" USING btree ("shop_id","created_at");--> statement-breakpoint
CREATE INDEX "subscriptions_expiry_idx" ON "subscriptions" USING btree ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_one_active_per_shop" ON "subscriptions" USING btree ("shop_id") WHERE "subscriptions"."status" = 'active';