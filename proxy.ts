import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export default async function middleware(request: NextRequest) {
  const authSecret =
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    process.env.AUTH_GOOGLE_SECRET ??
    process.env.GOOGLE_CLIENT_SECRET ??
    process.env.GOOGLE_SECRET;
  const token = await getToken({
    req: request,
    secret: authSecret,
  });
  const isAuthenticated = Boolean(token?.appUserId ?? token?.sub);
  const { pathname } = request.nextUrl;

  if (pathname === "/sign-in") {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/images") || pathname.startsWith("/api/folders")) {
    if (!isAuthenticated) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (pathname === "/" && !isAuthenticated) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/sign-in", "/api/images/:path*", "/api/folders/:path*"],
};
