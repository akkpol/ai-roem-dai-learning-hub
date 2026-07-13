import { describe, expect, it } from "vitest";
import { renderCertificatePdf } from "@/lib/certificates/pdf";

describe("renderCertificatePdf", () => {
  it("renders a downloadable PDF with Thai certificate content", async () => {
    const pdf = await renderCertificatePdf({
      certificateCode: "ARD-2569-0001",
      learnerName: "กาญจนา ตั้งใจเรียน",
      courseTitle: "AI Fundamentals สำหรับผู้เริ่มต้น",
      instructorName: "ดร. ณัฐพงศ์ วงศ์ไอที",
      completedAt: new Date("2026-07-12T00:00:00.000Z"),
      templateVersion: "beta-v1",
    });

    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.length).toBeGreaterThan(1_000);
  });
});
