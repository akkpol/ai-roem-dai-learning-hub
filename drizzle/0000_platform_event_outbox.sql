CREATE TABLE "platform_event_consumptions" (
	"consumer_name" text NOT NULL,
	"event_id" uuid NOT NULL,
	"consumed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_event_consumptions_pk" PRIMARY KEY("consumer_name","event_id")
);
--> statement-breakpoint
CREATE TABLE "platform_event_outbox" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"claimed_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"last_error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_event_outbox_state_check" CHECK ("platform_event_outbox"."state" in ('pending','publishing','retry_wait','published','dead_letter')),
	CONSTRAINT "platform_event_outbox_attempt_count_check" CHECK ("platform_event_outbox"."attempt_count" >= 0)
);
--> statement-breakpoint
CREATE INDEX "platform_event_outbox_dispatch_idx" ON "platform_event_outbox" USING btree ("state","available_at");--> statement-breakpoint
CREATE INDEX "platform_event_outbox_aggregate_idx" ON "platform_event_outbox" USING btree ("aggregate_type","aggregate_id","occurred_at");
--> statement-breakpoint
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO learning_hub_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM learning_hub_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE USAGE, SELECT ON SEQUENCES FROM learning_hub_app;
--> statement-breakpoint
GRANT INSERT ON TABLE platform_event_outbox TO learning_hub_app;
--> statement-breakpoint
GRANT INSERT ON TABLE platform_event_consumptions TO learning_hub_app;
--> statement-breakpoint
GRANT SELECT (event_id) ON TABLE platform_event_consumptions TO learning_hub_app;
