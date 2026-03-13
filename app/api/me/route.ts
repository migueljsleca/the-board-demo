import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserById } from "@/lib/database";
import { getDemoViewer, getRequestUserId, isNoDatabaseDemoMode } from "@/lib/dev-mode";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const userId = getRequestUserId(session);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (isNoDatabaseDemoMode()) {
    return NextResponse.json({ user: getDemoViewer() });
  }

  const dbUser = await getUserById(userId);
  const user = {
    id: userId,
    name: dbUser?.name ?? session?.user?.name ?? null,
    email: dbUser?.email ?? session?.user?.email ?? null,
    image: dbUser?.image ?? session?.user?.image ?? null,
  };

  return NextResponse.json({ user });
}
