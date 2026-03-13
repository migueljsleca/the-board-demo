import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getRequestUserId, isNoDatabaseDemoMode } from "@/lib/dev-mode";
import { createImage, listBoardData } from "@/lib/image-db";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const userId = getRequestUserId(session);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (isNoDatabaseDemoMode()) {
    return NextResponse.json({ images: [], folders: [] });
  }

  try {
    const boardData = await listBoardData(userId);
    return NextResponse.json(boardData);
  } catch {
    return NextResponse.json({ error: "Failed to load images." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = getRequestUserId(session);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (isNoDatabaseDemoMode()) {
    return NextResponse.json(
      { error: "Local demo mode is active. Configure POSTGRES_URL and BLOB_READ_WRITE_TOKEN to save images." },
      { status: 503 },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("image");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Image file is required." }, { status: 400 });
    }

    const width = Number(formData.get("width"));
    const height = Number(formData.get("height"));
    const rawFolderId = formData.get("folderId");
    if (rawFolderId !== null && typeof rawFolderId !== "string") {
      return NextResponse.json({ error: "folderId must be a string." }, { status: 400 });
    }
    const folderId = rawFolderId && rawFolderId.trim() ? rawFolderId : null;
    const image = await createImage(userId, { file, width, height, folderId });
    return NextResponse.json({ image }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to store image." }, { status: 500 });
  }
}
