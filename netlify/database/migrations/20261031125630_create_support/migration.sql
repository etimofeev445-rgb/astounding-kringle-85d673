CREATE TABLE "support_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"ticket_id" uuid NOT NULL,
	"role" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"telegram_user_id" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"escalated_reason" text DEFAULT '' NOT NULL,
	"ai_replies" integer DEFAULT 0 NOT NULL,
	"unread" boolean DEFAULT false NOT NULL,
	"escalated_at" timestamp,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "support_messages_ticket_idx" ON "support_messages" ("ticket_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "support_tickets_user_open_idx" ON "support_tickets" ("telegram_user_id") WHERE status <> 'closed';--> statement-breakpoint
CREATE INDEX "support_tickets_status_idx" ON "support_tickets" ("status","updated_at");