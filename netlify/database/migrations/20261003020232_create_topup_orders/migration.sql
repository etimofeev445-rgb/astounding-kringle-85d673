CREATE TABLE "topup_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"telegram_user_id" text NOT NULL,
	"operator" text NOT NULL,
	"phone" text NOT NULL,
	"amount_kop" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"telegram_charge_id" text,
	"provider_charge_id" text,
	"aggregator_ref" text,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
