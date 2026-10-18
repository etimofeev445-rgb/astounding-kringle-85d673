CREATE TABLE "places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"telegram_user_id" text NOT NULL,
	"store_key" text NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"hours" text DEFAULT '' NOT NULL,
	"price" text DEFAULT '' NOT NULL,
	"map_url" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"instagram" text DEFAULT '' NOT NULL,
	"tg_contact" text DEFAULT '' NOT NULL,
	"has_photo" boolean DEFAULT false NOT NULL,
	"has_cover" boolean DEFAULT false NOT NULL,
	"channel_chat_id" text,
	"channel_message_ids" integer[] DEFAULT '{}'::integer[] NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "places_status_idx" ON "places" ("status","created_at");--> statement-breakpoint
CREATE INDEX "places_store_idx" ON "places" ("store_key");--> statement-breakpoint
CREATE INDEX "places_user_idx" ON "places" ("telegram_user_id");