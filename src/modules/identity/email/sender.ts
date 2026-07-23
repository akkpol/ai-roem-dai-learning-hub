export type AuthEmailMessage = {
  template: "verify_email" | "reset_password" | "deletion_confirmation";
  recipient: string;
  actionUrl: string;
  idempotencyKey: string;
};

export interface AuthEmailSender {
  send(message: AuthEmailMessage): Promise<{ providerMessageId: string }>;
}

export class AuthEmailProviderError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;

  constructor(input: {
    code: string;
    retryable: boolean;
    retryAfterMs?: number;
  }) {
    super("authentication email provider rejected request");
    this.name = "AuthEmailProviderError";
    this.code = input.code;
    this.retryable = input.retryable;
    this.retryAfterMs = input.retryAfterMs;
  }
}
