import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  auditLogs,
  certificates,
  cohorts,
  courseInstructors,
  courses,
  enrollmentCompletions,
  enrollments,
  instructors,
  productEvents,
  profiles,
} from "@/db/schema";
import { requireAdmin, requireMember } from "@/lib/auth/authorization";
import { renderCertificatePdf } from "@/lib/certificates/pdf";
import { putPrivateDocument } from "@/lib/storage/private-blob";

const uuidSchema = z.string().uuid();

function certificateCode() {
  const year = new Date().toLocaleDateString("th-TH", { year: "numeric" });
  return `ARD-${year}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

async function storeCertificatePdf(certificateId: string) {
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) return null;
  const [certificate] = await getDb()
    .select()
    .from(certificates)
    .where(eq(certificates.id, certificateId))
    .limit(1);
  if (!certificate) return null;

  try {
    const pdf = await renderCertificatePdf({
      certificateCode: certificate.certificateCode,
      learnerName: certificate.learnerNameSnapshot,
      courseTitle: certificate.courseTitleSnapshot,
      instructorName: certificate.instructorNameSnapshot,
      completedAt: certificate.completedAtSnapshot,
      templateVersion: certificate.templateVersion,
    });
    const blob = await putPrivateDocument(
      `certificates/${certificate.id}.pdf`,
      pdf,
      "application/pdf",
    );
    await getDb()
      .update(certificates)
      .set({ pdfBlobPathname: blob.pathname })
      .where(eq(certificates.id, certificate.id));
    return blob.pathname;
  } catch (error) {
    await getDb().insert(productEvents).values({
      eventName: "certificate_generation_failure",
      properties: {
        certificateId,
        error: error instanceof Error ? error.message.slice(0, 300) : "Unknown PDF error",
      },
    });
    throw error;
  }
}

export async function issueCertificateByAdmin(rawEnrollmentId: string) {
  const enrollmentId = uuidSchema.parse(rawEnrollmentId);
  const admin = await requireAdmin();

  const certificate = await getDb().transaction(async (tx) => {
    const [snapshot] = await tx
      .select({
        enrollmentId: enrollments.id,
        learnerName: profiles.displayName,
        courseId: courses.id,
        courseTitle: courses.title,
        completedAt: enrollmentCompletions.completedAt,
        completionStatus: enrollmentCompletions.status,
      })
      .from(enrollments)
      .innerJoin(profiles, eq(profiles.userId, enrollments.userId))
      .innerJoin(cohorts, eq(cohorts.id, enrollments.cohortId))
      .innerJoin(courses, eq(courses.id, cohorts.courseId))
      .innerJoin(
        enrollmentCompletions,
        eq(enrollmentCompletions.enrollmentId, enrollments.id),
      )
      .where(eq(enrollments.id, enrollmentId))
      .limit(1);
    if (!snapshot || snapshot.completionStatus !== "completed" || !snapshot.completedAt) {
      throw new Error("ออกใบประกาศได้เมื่อ enrollment ผ่านเกณฑ์และจบหลักสูตรแล้วเท่านั้น");
    }

    const [activeCertificate] = await tx
      .select()
      .from(certificates)
      .where(and(eq(certificates.enrollmentId, enrollmentId), isNull(certificates.revokedAt)))
      .limit(1);
    if (activeCertificate) return activeCertificate;

    const [instructor] = await tx
      .select({ name: instructors.name })
      .from(courseInstructors)
      .innerJoin(instructors, eq(instructors.id, courseInstructors.instructorId))
      .where(eq(courseInstructors.courseId, snapshot.courseId))
      .limit(1);
    const [created] = await tx
      .insert(certificates)
      .values({
        enrollmentId,
        certificateCode: certificateCode(),
        shareSlug: randomUUID(),
        learnerNameSnapshot: snapshot.learnerName,
        courseTitleSnapshot: snapshot.courseTitle,
        instructorNameSnapshot: instructor?.name ?? "ทีม AI เริ่มได้",
        completedAtSnapshot: snapshot.completedAt,
        templateVersion: "beta-v1",
      })
      .returning();
    await tx.insert(auditLogs).values({
      actorUserId: admin.userId,
      action: "certificate.issue",
      entityType: "certificate",
      entityId: created.id,
      metadata: { enrollmentId },
    });
    return created;
  });

  await storeCertificatePdf(certificate.id);
  return certificate;
}

export async function setCertificateVisibility(input: {
  certificateId: string;
  publicVerificationEnabled: boolean;
}) {
  const parsed = z
    .object({ certificateId: uuidSchema, publicVerificationEnabled: z.boolean() })
    .parse(input);
  const member = await requireMember();
  const [owned] = await getDb()
    .select({ enrollmentId: certificates.enrollmentId })
    .from(certificates)
    .innerJoin(enrollments, eq(enrollments.id, certificates.enrollmentId))
    .where(
      and(
        eq(certificates.id, parsed.certificateId),
        eq(enrollments.userId, member.userId),
        isNull(certificates.revokedAt),
      ),
    )
    .limit(1);
  if (!owned) throw new Error("ไม่พบใบประกาศที่แก้การแชร์ได้");

  await getDb().transaction(async (tx) => {
    await tx
      .update(certificates)
      .set({ publicVerificationEnabled: parsed.publicVerificationEnabled })
      .where(eq(certificates.id, parsed.certificateId));
    await tx.insert(auditLogs).values({
      actorUserId: member.userId,
      action: parsed.publicVerificationEnabled ? "certificate.make_public" : "certificate.make_private",
      entityType: "certificate",
      entityId: parsed.certificateId,
    });
  });
}

export async function revokeCertificate(input: { certificateId: string; reason: string }) {
  const parsed = z
    .object({ certificateId: uuidSchema, reason: z.string().trim().min(10).max(500) })
    .parse(input);
  const admin = await requireAdmin();
  const now = new Date();

  await getDb().transaction(async (tx) => {
    const [revoked] = await tx
      .update(certificates)
      .set({
        revokedAt: now,
        revocationReason: parsed.reason,
        publicVerificationEnabled: false,
      })
      .where(and(eq(certificates.id, parsed.certificateId), isNull(certificates.revokedAt)))
      .returning();
    if (!revoked) throw new Error("ไม่พบใบประกาศที่ revoke ได้");
    await tx.insert(auditLogs).values({
      actorUserId: admin.userId,
      action: "certificate.revoke",
      entityType: "certificate",
      entityId: revoked.id,
      metadata: { reason: parsed.reason },
    });
  });
}

export async function reissueCertificate(input: { certificateId: string; reason: string }) {
  const parsed = z
    .object({ certificateId: uuidSchema, reason: z.string().trim().min(10).max(500) })
    .parse(input);
  const admin = await requireAdmin();

  const created = await getDb().transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(certificates)
      .where(eq(certificates.id, parsed.certificateId))
      .for("update")
      .limit(1);
    if (!current) throw new Error("ไม่พบใบประกาศเดิม");

    const now = new Date();
    if (!current.revokedAt) {
      await tx
        .update(certificates)
        .set({
          revokedAt: now,
          revocationReason: parsed.reason,
          publicVerificationEnabled: false,
        })
        .where(eq(certificates.id, current.id));
    }
    const [replacement] = await tx
      .insert(certificates)
      .values({
        enrollmentId: current.enrollmentId,
        certificateCode: certificateCode(),
        shareSlug: randomUUID(),
        learnerNameSnapshot: current.learnerNameSnapshot,
        courseTitleSnapshot: current.courseTitleSnapshot,
        instructorNameSnapshot: current.instructorNameSnapshot,
        completedAtSnapshot: current.completedAtSnapshot,
        templateVersion: "beta-v1",
        reissuedFromCertificateId: current.id,
      })
      .returning();
    await tx.insert(auditLogs).values({
      actorUserId: admin.userId,
      action: "certificate.reissue",
      entityType: "certificate",
      entityId: replacement.id,
      metadata: { previousCertificateId: current.id, reason: parsed.reason },
    });
    return replacement;
  });

  await storeCertificatePdf(created.id);
  return created;
}
