import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { notificationOutbox } from "@/db/schema";
import { createGmailProvider } from "./gmail";
import {
  MAX_NOTIFICATION_ATTEMPTS,
  OUTBOX_STALE_LOCK_MS,
  nextRetryAt,
} from "./outbox-policy";
import type { EmailMessage, EmailProvider } from "./provider";

type ClaimedNotification = {
  id: string;
  recipient_email: string;
  payload: EmailMessage;
  attempts: number;
};

export async function queueNotification(input: {
  type: string;
  recipientEmail: string;
  dedupeKey: string;
  message: Omit<EmailMessage, "to">;
  scheduledAt?: Date;
}) {
  await getDb()
    .insert(notificationOutbox)
    .values({
      type: input.type,
      recipientEmail: input.recipientEmail,
      dedupeKey: input.dedupeKey,
      payload: { ...input.message, to: input.recipientEmail },
      scheduledAt: input.scheduledAt ?? new Date(),
    })
    .onConflictDoNothing({ target: notificationOutbox.dedupeKey });
}

async function claimBatch(limit: number): Promise<ClaimedNotification[]> {
  const result = await getDb().transaction(async (tx) =>
    tx.execute(sql`
      with picked as (
        select id
        from notification_outbox
        where attempts < ${MAX_NOTIFICATION_ATTEMPTS}
          and scheduled_at <= now()
          and (
            status in ('pending', 'failed')
            or (
              status = 'processing'
              and locked_at <= now() - (${OUTBOX_STALE_LOCK_MS} * interval '1 millisecond')
            )
          )
        order by scheduled_at asc
        for update skip locked
        limit ${limit}
      )
      update notification_outbox as outbox
      set status = 'processing', locked_at = now(), attempts = attempts + 1
      from picked
      where outbox.id = picked.id
      returning outbox.id, outbox.recipient_email, outbox.payload, outbox.attempts
    `),
  );

  return result.rows as ClaimedNotification[];
}

export async function sendPendingNotifications(
  provider: EmailProvider = createGmailProvider(),
  limit = 20,
) {
  const claimed = await claimBatch(limit);
  let sent = 0;
  let failed = 0;

  for (const item of claimed) {
    try {
      await provider.send({ ...item.payload, to: item.recipient_email });
      await getDb().execute(sql`
        update notification_outbox
        set status = 'sent', sent_at = now(), locked_at = null, last_error = null
        where id = ${item.id} and status = 'processing'
      `);
      sent += 1;
    } catch (error) {
      const retryAt = nextRetryAt(new Date(), item.attempts);
      await getDb().execute(sql`
        update notification_outbox
        set status = 'failed', scheduled_at = ${retryAt}, locked_at = null,
            last_error = ${error instanceof Error ? error.message.slice(0, 500) : "Unknown email error"}
        where id = ${item.id} and status = 'processing'
      `);
      failed += 1;
    }
  }

  return { claimed: claimed.length, sent, failed };
}
