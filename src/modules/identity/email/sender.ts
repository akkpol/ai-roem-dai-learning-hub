export type AuthEmailMessage = {
  template: "verify_email" | "reset_password";
  recipient: string;
  actionUrl: string;
  idempotencyKey: string;
};

export interface AuthEmailSender {
  send(message: AuthEmailMessage): Promise<{ providerMessageId: string }>;
}
