export const MAX_NOTIFICATION_ATTEMPTS = 5;
export const OUTBOX_STALE_LOCK_MS = 10 * 60_000;

export type OutboxClaimCandidate = {
  status: "pending" | "processing" | "sent" | "failed";
  attempts: number;
  scheduledAt: Date;
  lockedAt: Date | null;
};

export function isNotificationClaimable(candidate: OutboxClaimCandidate, now: Date) {
  if (
    candidate.status === "sent" ||
    candidate.attempts >= MAX_NOTIFICATION_ATTEMPTS ||
    candidate.scheduledAt.getTime() > now.getTime()
  ) {
    return false;
  }
  if (candidate.status === "processing") {
    return Boolean(
      candidate.lockedAt &&
        candidate.lockedAt.getTime() <= now.getTime() - OUTBOX_STALE_LOCK_MS,
    );
  }
  return candidate.status === "pending" || candidate.status === "failed";
}

export function nextRetryAt(now: Date, attempts: number) {
  const delayMinutes = Math.min(360, 5 * 2 ** Math.max(0, attempts));
  return new Date(now.getTime() + delayMinutes * 60_000);
}
