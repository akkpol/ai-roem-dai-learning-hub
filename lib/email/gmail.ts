import nodemailer from "nodemailer";
import type { EmailProvider } from "./provider";

type GmailEnvironment = Record<string, string | undefined>;

export function hasGmailConfiguration(environment: GmailEnvironment = process.env) {
  return Boolean(
    environment.GMAIL_SMTP_USER &&
      environment.GMAIL_SMTP_APP_PASSWORD &&
      environment.EMAIL_FROM,
  );
}

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
