import { describe, expect, it } from "vitest";

import { redactAuditPayload } from "@/modules/identity/audit";

describe("SESSION-005 identity audit redaction", () => {
  it("recursively replaces credentials and tokens without leaking values", () => {
    const payload = redactAuditPayload({
      reasonCode: "policy_violation",
      password: "super-secret-password",
      nested: {
        sessionToken: "raw-session-token",
        totpSecret: "raw-totp-secret",
        recovery_code: "raw-recovery-code",
        safe: "preserved",
      },
    });
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("super-secret-password");
    expect(serialized).not.toContain("raw-session-token");
    expect(serialized).not.toContain("raw-totp-secret");
    expect(serialized).not.toContain("raw-recovery-code");
    expect(payload).toMatchObject({
      reasonCode: "policy_violation",
      password: "[REDACTED]",
      nested: {
        sessionToken: "[REDACTED]",
        totpSecret: "[REDACTED]",
        recovery_code: "[REDACTED]",
        safe: "preserved",
      },
    });
  });
});
