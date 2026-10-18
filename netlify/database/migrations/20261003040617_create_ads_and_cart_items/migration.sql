CREATE TABLE "ads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"telegram_user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"price" integer,
	"phone" text DEFAULT '' NOT NULL,
	"tg_contact" text DEFAULT '' NOT NULL,
	"has_photo" boolean DEFAULT false NOT NULL,
	"channel_chat_id" text,
	"channel_message_id" integer,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"telegram_user_id" text NOT NULL,
	"kind" text NOT NULL,
	"ref" text NOT NULL,
	"title" text NOT NULL,
	"subtitle" text DEFAULT '' NOT NULL,
	"url" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ads_status_created_idx" ON "ads" ("status","created_at");--> statement-breakpoint
CREATE INDEX "ads_user_idx" ON "ads" ("telegram_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cart_items_user_kind_ref_idx" ON "cart_items" ("telegram_user_id","kind","ref");