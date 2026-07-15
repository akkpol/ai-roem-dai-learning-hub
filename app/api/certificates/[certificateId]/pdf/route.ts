import { getCurrentMember } from "@/lib/auth/session";
import { hasRole } from "@/lib/auth/roles";
import { renderCertificatePdf } from "@/lib/certificates/pdf";
import { getCertificateById } from "@/lib/data/read-model";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ certificateId: string }> },
) {
  const member = await getCurrentMember();
  if (!member) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { certificateId } = await params;
  const certificate = await getCertificateById(
    certificateId,
    member.userId,
    hasRole(member.roles, "admin"),
  );
  if (!certificate) return Response.json({ error: "Not found" }, { status: 404 });

  const pdf = await renderCertificatePdf(certificate);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="certificate-${certificate.certificateCode}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
