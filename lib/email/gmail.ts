import nodemailer from "nodemailer";
import type { EmailProvider } from "./provider";

export function createGmailProvider(): EmailProvider {
  const user = process.env.GMAIL_SMTP_USER;
  const password = process.env.GMAIL_SMTP_APP_PASSWORD;
  const from = process.env.EMAIL_FROM;

  if (!user || !password || !from) {
    throw new Error("Gmail SMTP environment variables are incomplete.");
  }

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass: password },
  });

  return {
    async send(message) {
      const info = await transporter.sendMail({
        from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      return { providerMessageId: info.messageId };
    },
  };
}
