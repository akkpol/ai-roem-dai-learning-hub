import { describe, expect, it } from "vitest";

import {
  decryptAuthEmailIntent,
  encryptAuthEmailIntent,
  hashAuthEmailRecipient,
} from "@/modules/identity/email/crypto";

const key = Buffer.alloc(32, 11);
const intent = {
  template: "reset_password" as const,
  email: "user@example.test",
  token: "plaintext-reset-token",
  url: "https://learning.example.test/reset-password?token=plaintext-reset-token",
};

describe("Authentication email encryption", () => {
  it("round-trips an intent with randomized AES-GCM ciphertext", () => {
    const first = encryptAuthEmailIntent(intent, key);
    const second = encryptAuthEmailIntent(intent, key);
    expect(first).not.toBe(second);
    expect(first).not.toContain(intent.token);
    expect(decryptAuthEmailIntent(first, key)).toEqual(intent);
  });

  it("rejects tampering without exposing plaintext", () => {
    const encrypted = encryptAuthEmailIntent(intent, key);
    expect(() => decryptAuthEmailIntent(`${encrypted}x`, key)).toThrow(
      "authentication email payload is invalid",
    );
  });

  it("hashes canonical recipients without retaining the email", () => {
    const hash = hashAuthEmailRecipient("User@Example.TEST", key);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain("example.test");
  });
});
