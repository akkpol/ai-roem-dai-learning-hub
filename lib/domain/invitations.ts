import { z } from "zod";

const emailSchema = z.string().email();

export function assertInviteCapacity(existingCount: number, additions: number) {
  if (existingCount < 0 || additions < 0 || existingCount + additions > 50) {
    throw new Error("เชิญได้ไม่เกิน 50 อีเมลต่อรุ่น");
  }
}

export function normalizeInviteEmails(value: string) {
  const emails = [
    ...new Set(
      value
        .split(/[\s,;]+/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  if (emails.length > 50) {
    throw new Error("เชิญได้ไม่เกิน 50 อีเมลต่อรุ่น");
  }
  return emails.map((email) => emailSchema.parse(email));
}
