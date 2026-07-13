import { describe, expect, it } from "vitest";
import { normalizeInviteEmails } from "@/lib/domain/invitations";

describe("normalizeInviteEmails", () => {
  it("normalizes, validates, and deduplicates invited addresses", () => {
    expect(normalizeInviteEmails(" A@Example.com\na@example.com, b@gmail.com ")).toEqual([
      "a@example.com",
      "b@gmail.com",
    ]);
  });

  it("rejects more than 50 addresses for a cohort", () => {
    const emails = Array.from({ length: 51 }, (_, index) => `person${index}@example.com`).join("\n");
    expect(() => normalizeInviteEmails(emails)).toThrow("50");
  });
});
