import { NextResponse, type NextRequest } from "next/server";
import { getNeonAuth, isLocalDemoMode } from "@/lib/auth/server";

export async function proxy(request: NextRequest) {
  const auth = getNeonAuth();
  if (!auth) {
    if (isLocalDemoMode()) {
      return NextResponse.next();
    }

    const signInUrl = new URL("/auth/sign-in", request.url);
    signInUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(signInUrl);
  }

  return auth.middleware({ loginUrl: "/auth/sign-in" })(request);
}

export const config = {
  matcher: ["/learn/:path*", "/teach/:path*", "/account/:path*", "/admin/:path*"],
};
