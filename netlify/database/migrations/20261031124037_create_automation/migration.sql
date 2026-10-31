CREATE TABLE "automation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"module" text NOT NULL,
	"level" text DEFAULT 'info' NOT NULL,
	"kind" text NOT NULL,
	"message" text NOT NULL,
	"details" jsonb DEFAULT '{}' NOT NULL,
	"job_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"module" text NOT NULL,
	"lock_group" text NOT NULL,
	"trigger" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"progress_text" text DEFAULT '' NOT NULL,
	"state" jsonb DEFAULT '{}' NOT NULL,
	"result" jsonb,
	"summary" text DEFAULT '' NOT NULL,
	"error" text DEFAULT '' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_by" text DEFAULT '' NOT NULL,
	"scheduled_for" timestamp,
	"started_at" timestamp,
	"heartbeat_at" timestamp,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "broadcasts" ADD COLUMN "audience" text DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE "broadcasts" ADD COLUMN "scheduled_at" timestamp;--> statement-breakpoint
CREATE INDEX "automation_events_created_idx" ON "automation_events" ("created_at");--> statement-breakpoint
CREATE INDEX "automation_events_kind_idx" ON "automation_events" ("kind","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "automation_jobs_module_open_idx" ON "automation_jobs" ("module") WHERE status in ('queued', 'running', 'paused');--> statement-breakpoint
CREATE UNIQUE INDEX "automation_jobs_lock_running_idx" ON "automation_jobs" ("lock_group") WHERE status = 'running';--> statement-breakpoint
CREATE INDEX "automation_jobs_module_created_idx" ON "automation_jobs" ("module","created_at");--> statement-breakpoint
CREATE INDEX "automation_jobs_status_idx" ON "automation_jobs" ("status","created_at");