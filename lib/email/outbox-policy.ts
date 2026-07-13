export const MAX_NOTIFICATION_ATTEMPTS = 5;

export function nextRetryAt(now: Date, attempts: number) {
  const delayMinutes = Math.min(360, 5 * 2 ** Math.max(0, attempts));
  return new Date(now.getTime() + delayMinutes * 60_000);
}
