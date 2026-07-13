import { getNeonAuth } from "@/lib/auth/server";

type RouteContext = { params: Promise<{ path: string[] }> };

function unavailable() {
  return Response.json(
    { error: "Neon Auth is not configured for this environment." },
    { status: 503 },
  );
}

export async function GET(request: Request, context: RouteContext) {
  const auth = getNeonAuth();
  return auth ? auth.handler().GET(request, context) : unavailable();
}

export async function POST(request: Request, context: RouteContext) {
  const auth = getNeonAuth();
  return auth ? auth.handler().POST(request, context) : unavailable();
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = getNeonAuth();
  return auth ? auth.handler().PUT(request, context) : unavailable();
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = getNeonAuth();
  return auth ? auth.handler().PATCH(request, context) : unavailable();
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = getNeonAuth();
  return auth ? auth.handler().DELETE(request, context) : unavailable();
}
