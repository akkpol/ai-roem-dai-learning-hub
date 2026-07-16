import { Resend } from "resend";

import type { AuthEmailMessage, AuthEmailSender } from "./sender";

type ResendResponse = {
  data: { id: string } | null;
  error: { name?: string; message?: string } | null;
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
        throw new Error("authentication email provider rejected request");
      }
      return { providerMessageId: response.data.id };
    },
  };
}

export function createConfiguredResendAuthEmailSender(
  apiKey: string,
  from: string,
): AuthEmailSender {
  return createResendAuthEmailSender(new Resend(apiKey), from);
}
