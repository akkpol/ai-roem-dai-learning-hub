CREATE TABLE "identity_email_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" text NOT NULL,
	"outbox_id" uuid,
	"provider_message_id" text NOT NULL,
	"state" text NOT NULL,
	"provider_created_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "identity_email_deliveries_event_id_unique" UNIQUE("event_id"),
	CONSTRAINT "identity_email_deliveries_state_check" CHECK ("identity_email_deliveries"."state" in ('sent','delivered','bounced','complained','failed'))
);
--> statement-breakpoint
ALTER TABLE "identity_email_outbox" ADD COLUMN "lease_token" uuid;--> statement-breakpoint
ALTER TABLE "identity_email_outbox" ADD COLUMN "lease_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "identity_email_outbox" ADD COLUMN "provider_message_id" text;--> statement-breakpoint
ALTER TABLE "identity_email_outbox" ADD COLUMN "sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "identity_email_outbox" ADD COLUMN "last_error_code" text;--> statement-breakpoint
UPDATE identity_email_outbox
SET encrypted_payload = NULL
WHERE state IN ('sent', 'dead_letter', 'expired');--> statement-breakpoint
UPDATE identity_email_outbox
SET
  state = 'retry_wait',
  next_attempt_at = LEAST(next_attempt_at, transaction_timestamp())
WHERE state = 'sending';--> statement-breakpoint
ALTER TABLE "identity_email_deliveries" ADD CONSTRAINT "identity_email_deliveries_outbox_id_identity_email_outbox_id_fk" FOREIGN KEY ("outbox_id") REFERENCES "public"."identity_email_outbox"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "identity_email_deliveries_message_time_idx" ON "identity_email_deliveries" USING btree ("provider_message_id","provider_created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "identity_email_outbox_provider_message_unique" ON "identity_email_outbox" USING btree ("provider_message_id") WHERE "identity_email_outbox"."provider_message_id" is not null;--> statement-breakpoint
ALTER TABLE "identity_email_outbox" ADD CONSTRAINT "identity_email_outbox_lease_check" CHECK (("identity_email_outbox"."state" = 'sending' and "identity_email_outbox"."lease_token" is not null and "identity_email_outbox"."lease_expires_at" is not null) or ("identity_email_outbox"."state" <> 'sending' and "identity_email_outbox"."lease_token" is null and "identity_email_outbox"."lease_expires_at" is null));--> statement-breakpoint
ALTER TABLE "identity_email_outbox" ADD CONSTRAINT "identity_email_outbox_payload_check" CHECK (("identity_email_outbox"."state" in ('sent','dead_letter','expired') and "identity_email_outbox"."encrypted_payload" is null) or ("identity_email_outbox"."state" in ('pending','sending','retry_wait') and "identity_email_outbox"."encrypted_payload" is not null));--> statement-breakpoint
DO $learning_hub_email_worker_role$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_roles
    WHERE rolname = 'learning_hub_identity_email_worker'
  ) THEN
    CREATE ROLE learning_hub_identity_email_worker NOLOGIN;
  END IF;
END
$learning_hub_email_worker_role$;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO learning_hub_identity_email_worker;--> statement-breakpoint
REVOKE UPDATE ON TABLE identity_email_outbox FROM learning_hub_app;--> statement-breakpoint
GRANT SELECT, UPDATE ON TABLE identity_email_outbox TO learning_hub_identity_email_worker;--> statement-breakpoint
GRANT SELECT, INSERT ON TABLE identity_email_deliveries TO learning_hub_identity_email_worker;--> statement-breakpoint
GRANT SELECT, DELETE ON TABLE identity_email_deliveries TO learning_hub_identity_maintenance;
