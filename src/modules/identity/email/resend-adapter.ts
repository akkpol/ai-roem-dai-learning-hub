import { Resend } from "resend";

import {
  AuthEmailProviderError,
  type AuthEmailMessage,
  type AuthEmailSender,
} from "./sender";

type ResendResponse = {
  data: { id: string } | null;
  error: { name?: string; message?: string; statusCode?: number | null } | null;
};

type ResendClient = {
  emails: {
    send(
      payload: { from: string; to: string[]; subject: string; text: string },
      options: { idempotencyKey: string },
    ): Promise<ResendResponse>;
  };
};

function render(message: AuthEmailMessage): { subject: string; text: string } {
  if (message.template === "verify_email") {
    return {
      subject: "ยืนยันอีเมล Learning Hub",
      text: `ยืนยันอีเมลของคุณเพื่อเริ่มใช้งาน Learning Hub: ${message.actionUrl}`,
    };
  }
  if (message.template === "deletion_confirmation") {
    return {
      subject: "ยืนยันการลบบัญชี Learning Hub",
      text: `ยืนยันคำขอลบบัญชีภายใน 30 นาที: ${message.actionUrl}`,
    };
  }
  return {
    subject: "ตั้งรหัสผ่าน Learning Hub ใหม่",
    text: `ตั้งรหัสผ่านใหม่ภายใน 30 นาที: ${message.actionUrl}`,
  };
}

export function createResendAuthEmailSender(
  client: ResendClient,
  from: string,
): AuthEmailSender {
  return {
    send: async (message) => {
      const rendered = render(message);
      try {
        const response = await client.emails.send(
          {
            from,
            to: [message.recipient],
            subject: rendered.subject,
            text: rendered.text,
          },
          { idempotencyKey: message.idempotencyKey },
        );
        if (response.error || !response.data) {
          const statusCode = response.error?.statusCode ?? null;
          const retryable =
            statusCode === 429 ||
            (statusCode !== null && statusCode >= 500) ||
            response.error?.name === "concurrent_idempotent_requests";
          throw new AuthEmailProviderError({
            code: retryable
              ? statusCode === 429
                ? "rate_limited"
                : response.error?.name === "concurrent_idempotent_requests"
                  ? "idempotency_in_progress"
                  : "provider_unavailable"
              : "provider_rejected",
            retryable,
          });
        }
        return { providerMessageId: response.data.id };
      } catch (error) {
        if (error instanceof AuthEmailProviderError) throw error;
        throw new AuthEmailProviderError({
          code: "provider_unavailable",
          retryable: true,
        });
      }
    },
  };
}

export function createConfiguredResendAuthEmailSender(
  apiKey: string,
  from: string,
): AuthEmailSender {
  return createResendAuthEmailSender(new Resend(apiKey), from);
}
