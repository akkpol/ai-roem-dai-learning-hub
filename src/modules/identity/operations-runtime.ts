import { randomUUID } from "node:crypto";

import { Resend, type WebhookEventPayload } from "resend";

import {
  createDatabaseConnection,
  type DatabaseConnection,
} from "@/platform/database/client";
import { readDatabaseConfig } from "@/platform/database/config";

import { readIdentityConfig } from "./config";
import { decryptAuthEmailIntent } from "./email/crypto";
import {
  createAuthEmailDispatcher,
  createPostgresAuthEmailOutboxRepository,
} from "./email/dispatcher";
import { createConfiguredResendAuthEmailSender } from "./email/resend-adapter";
import {
  createPostgresResendDeliveryLedger,
  createResendWebhookHandler,
  type VerifiedResendEvent,
} from "./email/webhook";
import { createIdentityJobHandlers, readCronSecret } from "./jobs";
import { runIdentityRetention } from "./privacy";

function readBoundedSecret(
  input: Record<string, string | undefined>,
  name: string,
  minimum: number,
  maximum = 512,
): string {
  const value = input[name];
  if (!value || value.length < minimum || value.length > maximum) {
    throw new Error("identity operations configuration is invalid");
  }
  return value;
}

function operationsConnection(variable: string): DatabaseConnection {
  const url = readBoundedSecret(process.env, variable, 1, 4_096);
  return createDatabaseConnection(
    readDatabaseConfig({ ...process.env, DATABASE_URL: url }),
  );
}

export function probeIdentityOperationsConfiguration(
  input: Record<string, string | undefined>,
): void {
  const config = readIdentityConfig(input);
  if (!config.resendApiKey) {
    throw new Error("identity operations configuration is invalid");
  }
  readCronSecret(input);
  readBoundedSecret(input, "RESEND_WEBHOOK_SECRET", 16);
  for (const variable of [
    "IDENTITY_EMAIL_WORKER_DATABASE_URL",
    "IDENTITY_MAINTENANCE_DATABASE_URL",
  ] as const) {
    const url = readBoundedSecret(input, variable, 1, 4_096);
    readDatabaseConfig({ ...input, DATABASE_URL: url });
  }
}

function telemetry(
  event: string,
  fields: Record<string, string | number | boolean>,
) {
  console.info(event, fields);
}

export function getIdentityJobHandlers() {
  return createIdentityJobHandlers({
    cronSecret: readCronSecret(process.env),
    telemetry,
    dispatchEmail: async () => {
      const config = readIdentityConfig(process.env);
      if (!config.resendApiKey) {
        throw new Error("identity email provider is not configured");
      }
      const connection = operationsConnection(
        "IDENTITY_EMAIL_WORKER_DATABASE_URL",
      );
      try {
        return await createAuthEmailDispatcher({
          repository: createPostgresAuthEmailOutboxRepository(connection.db),
          sender: createConfiguredResendAuthEmailSender(
            config.resendApiKey,
            config.emailFrom,
          ),
          decrypt: (payload) =>
            decryptAuthEmailIntent(payload, config.emailEncryptionKey),
          workerId: `vercel:${process.env.VERCEL_REGION ?? "unknown"}:${randomUUID()}`,
          telemetry,
        }).runBatch(50);
      } finally {
        await connection.close();
      }
    },
    runRetention: async () => {
      const connection = operationsConnection(
        "IDENTITY_MAINTENANCE_DATABASE_URL",
      );
      try {
        return await runIdentityRetention(connection.db, {
          dryRun: false,
          batchLimit: 100,
        });
      } finally {
        await connection.close();
      }
    },
  });
}

function normalizeWebhookEvent(
  event: WebhookEventPayload,
): VerifiedResendEvent {
  if (!event.type.startsWith("email.") || !("email_id" in event.data)) {
    return {
      type: event.type,
      createdAt: event.created_at,
      data: { emailId: "" },
    };
  }
  return {
    type: event.type,
    createdAt: event.created_at,
    data: { emailId: event.data.email_id },
  };
}

export async function handleResendWebhookRequest(
  request: Request,
): Promise<Response> {
  const webhookSecret = readBoundedSecret(
    process.env,
    "RESEND_WEBHOOK_SECRET",
    16,
  );
  const resend = new Resend(process.env.RESEND_API_KEY);
  return createResendWebhookHandler({
    verifier: {
      verify: (payload, headers) =>
        normalizeWebhookEvent(
          resend.webhooks.verify({ payload, headers, webhookSecret }),
        ),
    },
    ledger: async () => {
      const connection = operationsConnection(
        "IDENTITY_EMAIL_WORKER_DATABASE_URL",
      );
      return {
        ledger: createPostgresResendDeliveryLedger(connection.db),
        close: () => connection.close(),
      };
    },
    telemetry,
  })(request);
}
