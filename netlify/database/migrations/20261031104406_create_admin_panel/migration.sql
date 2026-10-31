CREATE TABLE "admin_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"admin_id" text NOT NULL,
	"action" text NOT NULL,
	"target_kind" text DEFAULT '' NOT NULL,
	"target_id" text DEFAULT '' NOT NULL,
	"details" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"telegram_user_id" text NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY,
	"value" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "broadcasts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"text" text NOT NULL,
	"button_text" text DEFAULT '' NOT NULL,
	"button_url" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"sent" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"cursor" text DEFAULT '' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"url" text DEFAULT '' NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"telegram_user_id" text NOT NULL,
	"target_kind" text NOT NULL,
	"target_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"telegram_user_id" text PRIMARY KEY,
	"username" text DEFAULT '' NOT NULL,
	"first_name" text DEFAULT '' NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"language_code" text DEFAULT '' NOT NULL,
	"blocked" boolean DEFAULT false NOT NULL,
	"blocked_reason" text DEFAULT '' NOT NULL,
	"sessions" integer DEFAULT 0 NOT NULL,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ads" ADD COLUMN "moderation" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "moderation" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
CREATE INDEX "admin_log_created_idx" ON "admin_log" ("created_at");--> statement-breakpoint
CREATE INDEX "admin_log_target_idx" ON "admin_log" ("target_kind","target_id");--> statement-breakpoint
CREATE INDEX "app_events_created_idx" ON "app_events" ("created_at");--> statement-breakpoint
CREATE INDEX "app_events_user_idx" ON "app_events" ("telegram_user_id");--> statement-breakpoint
CREATE INDEX "documents_order_idx" ON "documents" ("sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_user_target_idx" ON "reports" ("telegram_user_id","target_kind","target_id");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "topup_orders_tg_charge_idx" ON "topup_orders" ("telegram_charge_id");--> statement-breakpoint
CREATE INDEX "users_first_seen_idx" ON "users" ("first_seen_at");--> statement-breakpoint
CREATE INDEX "users_last_seen_idx" ON "users" ("last_seen_at");