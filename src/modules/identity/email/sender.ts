export type AuthEmailMessage = {
  template: "verify_email" | "reset_password" | "deletion_confirmation";
  recipient: string;
  actionUrl: string;
  idempotencyKey: string;
};

export interface AuthEmailSender {
  send(message: AuthEmailMessage): Promise<{ providerMessageId: string }>;
}
