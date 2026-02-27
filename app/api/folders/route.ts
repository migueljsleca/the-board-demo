import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createFolder, listBoardData } from "@/lib/image-db";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const boardData = await listBoardData(userId);
    return NextResponse.json({ folders: boardData.folders });
  } catch {
    return NextResponse.json({ error: "Failed to load boards." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as { name?: unknown };
    if (typeof payload.name !== "string") {
      return NextResponse.json({ error: "Board name is required." }, { status: 400 });
    }

    const result = await createFolder(userId, { name: payload.name });
    if (result.kind === "invalid-name") {
      return NextResponse.json({ error: "Board name cannot be empty." }, { status: 400 });
    }
    if (result.kind === "duplicate-name") {
      return NextResponse.json({ error: "Board already exists." }, { status: 409 });
    }

    return NextResponse.json({ folder: result.folder }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create board." }, { status: 500 });
  }
}
