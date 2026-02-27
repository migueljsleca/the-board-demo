import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export default async function middleware(request: NextRequest) {
  const authSecret =
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET;
  const isSecureCookie = request.nextUrl.protocol === "https:";
  const sessionCookieName = isSecureCookie ? "__Secure-authjs.session-token" : "authjs.session-token";
  const token = await getToken({
    req: request,
    secret: authSecret,
    cookieName: sessionCookieName,
    // Auth.js v5 uses this salt for JWT session token encryption/decryption.
    salt: "authjs.session-token",
  });
  const isAuthenticated = Boolean(token?.appUserId ?? token?.sub);
  const { pathname } = request.nextUrl;

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
  matcher: ["/", "/sign-in", "/sign-up", "/api/images/:path*", "/api/folders/:path*"],
};
