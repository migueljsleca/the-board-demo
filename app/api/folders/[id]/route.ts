import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getRequestUserId, isNoDatabaseDemoMode } from "@/lib/dev-mode";
import { removeFolderById } from "@/lib/image-db";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await auth();
  const userId = getRequestUserId(session);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (isNoDatabaseDemoMode()) {
    return NextResponse.json({ error: "Local demo mode is active. Board deletion is disabled." }, { status: 503 });
  }

  try {
    const { id } = await context.params;
    const removed = await removeFolderById(userId, id);
    if (!removed) {
      return NextResponse.json({ error: "Board not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete board." }, { status: 500 });
  }
}
