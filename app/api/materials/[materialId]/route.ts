import { and, eq, inArray } from "drizzle-orm";
import { getDb, hasDatabaseConnection } from "@/db";
import { cohorts, courseMaterials, enrollments, productEvents } from "@/db/schema";
import { getCurrentMember } from "@/lib/auth/session";
import { getPrivateDocument } from "@/lib/storage/private-blob";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ materialId: string }> },
) {
  const member = await getCurrentMember();
  if (!member) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasDatabaseConnection()) {
    return Response.json({ error: "Demo documents are not stored in Blob." }, { status: 404 });
  }

  const { materialId } = await params;
  const [access] = await getDb()
    .select({ pathname: courseMaterials.blobPathname, title: courseMaterials.title })
    .from(courseMaterials)
    .innerJoin(cohorts, eq(cohorts.courseId, courseMaterials.courseId))
    .innerJoin(enrollments, eq(enrollments.cohortId, cohorts.id))
    .where(
      and(
        eq(courseMaterials.id, materialId),
        member.role === "admin" ? undefined : eq(enrollments.userId, member.userId),
        inArray(cohorts.status, ["confirmed", "in_progress", "completed"]),
      ),
    )
    .limit(1);
  if (!access?.pathname) {
    await getDb().insert(productEvents).values({
      eventName: "protected_access_failure",
      actorUserId: member.userId,
      properties: { materialId },
    });
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const result = await getPrivateDocument(access.pathname);
  if (!result || result.statusCode !== 200) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(result.stream, {
    headers: {
      "Content-Type": result.blob.contentType,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(access.title)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
