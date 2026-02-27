import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getUserById } from "@/lib/database";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const dbUser = await getUserById(userId);
  const user = {
    id: userId,
    name: dbUser?.name ?? session.user.name ?? null,
    email: dbUser?.email ?? session.user.email ?? null,
    image: dbUser?.image ?? session.user.image ?? null,
  };

  return NextResponse.json({ user });
}
