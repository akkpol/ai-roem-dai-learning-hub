import { timingSafeEqual } from "node:crypto";

import { z } from "zod";

const cronEnvironment = z.object({
  CRON_SECRET: z.string().min(32).max(256),
});

export function readCronSecret(
  input: Record<string, string | undefined>,
): string {
  try {
    return cronEnvironment.parse(input).CRON_SECRET;
  } catch {
    throw new Error("cron configuration is invalid");
  }
}

function equalSecret(candidate: string, expected: string): boolean {
  const candidateBytes = Buffer.from(candidate);
  const expectedBytes = Buffer.from(expected);
  return (
    candidateBytes.length === expectedBytes.length &&
    timingSafeEqual(candidateBytes, expectedBytes)
  );
}

export type CronAuthorization =
  | { allowed: true }
  | { allowed: false; status: 400 | 401 | 405 };

export function authorizeCronRequest(
  request: Request,
  secret: string,
): CronAuthorization {
  if (request.method !== "GET") return { allowed: false, status: 405 };
  if (new URL(request.url).search.length > 0) {
    return { allowed: false, status: 400 };
  }
  const authorization = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (
    !authorization.startsWith(prefix) ||
    !equalSecret(authorization.slice(prefix.length), secret)
  ) {
    return { allowed: false, status: 401 };
  }
  return { allowed: true };
}

export function createIdentityJobHandlers(input: {
  cronSecret: string;
  dispatchEmail(): Promise<Record<string, number>>;
  runRetention(): Promise<Record<string, unknown>>;
  telemetry?(
    event: string,
    fields: Record<string, string | number | boolean>,
  ): void;
}) {
  const run = async (
    request: Request,
    job: "email_delivery" | "retention",
  ): Promise<Response> => {
    const authorization = authorizeCronRequest(request, input.cronSecret);
    if (!authorization.allowed) {
      return Response.json(
        { error: "job_request_rejected" },
        {
          status: authorization.status,
          headers:
            authorization.status === 405 ? { Allow: "GET" } : undefined,
        },
      );
    }
    const startedAt = Date.now();
    try {
      const result =
        job === "email_delivery"
          ? await input.dispatchEmail()
          : await input.runRetention();
      input.telemetry?.("identity.job.completed", {
        job,
        durationMs: Date.now() - startedAt,
      });
      return Response.json({ status: "completed", result });
    } catch (error) {
      input.telemetry?.("identity.job.failed", {
        job,
        durationMs: Date.now() - startedAt,
        errorName: error instanceof Error ? error.name.slice(0, 64) : "unknown",
      });
      return Response.json({ error: "job_failed" }, { status: 503 });
    }
  };
  return {
    dispatchEmail: (request: Request) => run(request, "email_delivery"),
    retention: (request: Request) => run(request, "retention"),
  };
}
