import { randomUUID } from "node:crypto";
import { del, put } from "@vercel/blob";
import { sql } from "@vercel/postgres";
import type { BoardCanvasLayout, BoardFolder, BoardItem } from "@/lib/board-types";
import { ensureSchema } from "@/lib/database";

type ImageRow = {
  id: string;
  src: string;
  width: number;
  height: number;
  title: string;
  labels: string[] | null;
  folder_id: string | null;
  created_at: string | Date;
  filename: string;
  mime_type: string;
  canvas: unknown;
  blob_path: string;
};

type FolderRow = {
  id: string;
  name: string;
  created_at: string | Date;
};

function normalizeLabel(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeLabels(input: string[]) {
  const unique = new Set<string>();
  for (const label of input) {
    const normalized = normalizeLabel(label);
    if (!normalized) continue;
    unique.add(normalized);
  }
  return Array.from(unique).slice(0, 12);
}

function normalizeFolderName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeImageTitle(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 120);
}

function folderNameKey(value: string) {
  return normalizeFolderName(value).toLowerCase();
}

function safeDimension(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  const rounded = Math.round(value);
  if (rounded <= 0) return fallback;
  return rounded;
}

function extensionForMimeType(mimeType: string) {
  const mime = mimeType.toLowerCase();
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  if (mime === "image/avif") return "avif";
  if (mime === "image/svg+xml") return "svg";
  return "bin";
}

function parseStoredCanvasLayout(value: unknown): BoardCanvasLayout | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<BoardCanvasLayout>;
  const x = Number(candidate.x);
  const y = Number(candidate.y);
  const width = Number(candidate.width);
  const height = Number(candidate.height);
  const z = Number(candidate.z);

  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  if (!Number.isFinite(z)) return null;

  return {
    x: Math.round(x * 100) / 100,
    y: Math.round(y * 100) / 100,
    width: Math.round(width * 100) / 100,
    height: Math.round(height * 100) / 100,
    z: Math.round(z),
  };
}

function toIsoString(value: string | Date) {
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function mapFolderRow(row: FolderRow): BoardFolder {
  return {
    id: row.id,
    name: normalizeFolderName(row.name),
    createdAt: toIsoString(row.created_at),
  };
}

function mapImageRow(row: ImageRow): BoardItem {
  return {
    id: row.id,
    src: row.src,
    width: safeDimension(Number(row.width), 1200),
    height: safeDimension(Number(row.height), 1600),
    title: normalizeImageTitle(row.title ?? ""),
    labels: normalizeLabels(Array.isArray(row.labels) ? row.labels : []),
    folderId: row.folder_id,
    origin: "paste",
    createdAt: toIsoString(row.created_at),
    filename: row.filename,
    mimeType: row.mime_type || "application/octet-stream",
    canvas: parseStoredCanvasLayout(row.canvas),
  };
}

async function folderExistsForUser(userId: string, folderId: string) {
  const result = await sql<Pick<FolderRow, "id">>`
    SELECT id
    FROM folders
    WHERE id = ${folderId}::uuid
      AND user_id = ${userId}::uuid
    LIMIT 1
  `;
  return Boolean(result.rows[0]);
}

export async function listImages(userId: string) {
  const boardData = await listBoardData(userId);
  return boardData.images;
}

export async function listBoardData(userId: string) {
  await ensureSchema();

  const [imagesResult, foldersResult] = await Promise.all([
    sql<ImageRow>`
      SELECT id, src, width, height, title, labels, folder_id, created_at, filename, mime_type, canvas, blob_path
      FROM images
      WHERE user_id = ${userId}::uuid
      ORDER BY created_at DESC
    `,
    sql<FolderRow>`
      SELECT id, name, created_at
      FROM folders
      WHERE user_id = ${userId}::uuid
      ORDER BY LOWER(name) ASC
    `,
  ]);

  return {
    images: imagesResult.rows.map(mapImageRow),
    folders: foldersResult.rows.map(mapFolderRow),
  };
}

export async function createImage(
  userId: string,
  input: {
    file: File;
    width: number;
    height: number;
    folderId?: string | null;
  },
) {
  await ensureSchema();

  const id = randomUUID();
  const mimeType = input.file.type || "application/octet-stream";
  const ext = extensionForMimeType(mimeType);
  const filename = `${id}.${ext}`;
  const blobPath = `users/${userId}/images/${filename}`;

  const upload = await put(blobPath, input.file, {
    access: "public",
    addRandomSuffix: false,
    contentType: input.file.type || undefined,
  });

  const sanitizedFolderId =
    input.folderId && (await folderExistsForUser(userId, input.folderId)) ? input.folderId : null;

  const createdAt = new Date().toISOString();

  const result = await sql<ImageRow>`
    INSERT INTO images (
      id,
      user_id,
      folder_id,
      src,
      blob_path,
      width,
      height,
      title,
      labels,
      mime_type,
      created_at,
      filename,
      canvas
    )
    VALUES (
      ${id}::uuid,
      ${userId}::uuid,
      ${sanitizedFolderId}::uuid,
      ${upload.url},
      ${upload.pathname},
      ${safeDimension(input.width, 1200)},
      ${safeDimension(input.height, 1600)},
      '',
      ARRAY[]::text[],
      ${mimeType},
      ${createdAt}::timestamptz,
      ${filename},
      NULL
    )
    RETURNING id, src, width, height, title, labels, folder_id, created_at, filename, mime_type, canvas, blob_path
  `;

  return mapImageRow(result.rows[0]);
}

export async function removeImageById(userId: string, id: string) {
  await ensureSchema();

  const result = await sql<Pick<ImageRow, "blob_path">>`
    DELETE FROM images
    WHERE id = ${id}::uuid
      AND user_id = ${userId}::uuid
    RETURNING blob_path
  `;

  const removed = result.rows[0];
  if (!removed) return false;

  try {
    await del(removed.blob_path);
  } catch {
    // Keep DB deletion successful even if blob is already missing.
  }

  return true;
}

type UpdateImageByIdInput = {
  labels?: string[];
  folderId?: string | null;
  title?: string;
  canvas?: BoardCanvasLayout | null;
};

type UpdateImageByIdResult =
  | {
      kind: "ok";
      image: BoardItem;
    }
  | {
      kind: "image-not-found";
    }
  | {
      kind: "folder-not-found";
    };

export async function updateImageById(userId: string, id: string, input: UpdateImageByIdInput): Promise<UpdateImageByIdResult> {
  await ensureSchema();

  const existingResult = await sql<ImageRow>`
    SELECT id, src, width, height, title, labels, folder_id, created_at, filename, mime_type, canvas, blob_path
    FROM images
    WHERE id = ${id}::uuid
      AND user_id = ${userId}::uuid
    LIMIT 1
  `;

  const existing = existingResult.rows[0];
  if (!existing) return { kind: "image-not-found" };

  let nextFolderId = existing.folder_id;
  if (input.folderId !== undefined) {
    if (input.folderId === null) {
      nextFolderId = null;
    } else {
      const exists = await folderExistsForUser(userId, input.folderId);
      if (!exists) return { kind: "folder-not-found" };
      nextFolderId = input.folderId;
    }
  }

  const nextLabels = input.labels !== undefined ? normalizeLabels(input.labels) : normalizeLabels(Array.isArray(existing.labels) ? existing.labels : []);
  const nextLabelsJson = JSON.stringify(nextLabels);
  const nextTitle = input.title !== undefined ? normalizeImageTitle(input.title) : normalizeImageTitle(existing.title ?? "");
  const nextCanvas =
    input.canvas !== undefined
      ? input.canvas
        ? parseStoredCanvasLayout(input.canvas)
        : null
      : parseStoredCanvasLayout(existing.canvas);

  const updatedResult = await sql<ImageRow>`
    UPDATE images
    SET folder_id = ${nextFolderId}::uuid,
        labels = (
          SELECT COALESCE(ARRAY_AGG(value), ARRAY[]::text[])
          FROM JSONB_ARRAY_ELEMENTS_TEXT(${nextLabelsJson}::jsonb) AS value
        ),
        title = ${nextTitle},
        canvas = ${nextCanvas ? JSON.stringify(nextCanvas) : null}::jsonb
    WHERE id = ${id}::uuid
      AND user_id = ${userId}::uuid
    RETURNING id, src, width, height, title, labels, folder_id, created_at, filename, mime_type, canvas, blob_path
  `;

  return { kind: "ok", image: mapImageRow(updatedResult.rows[0]) };
}

type CreateFolderResult =
  | {
      kind: "ok";
      folder: BoardFolder;
    }
  | {
      kind: "invalid-name";
    }
  | {
      kind: "duplicate-name";
    };

export async function createFolder(userId: string, input: { name: string }): Promise<CreateFolderResult> {
  await ensureSchema();

  const normalizedName = normalizeFolderName(input.name);
  if (!normalizedName) return { kind: "invalid-name" };

  const normalizedKey = folderNameKey(normalizedName);
  const duplicateCheck = await sql<Pick<FolderRow, "id">>`
    SELECT id
    FROM folders
    WHERE user_id = ${userId}::uuid
      AND LOWER(name) = ${normalizedKey}
    LIMIT 1
  `;

  if (duplicateCheck.rows[0]) return { kind: "duplicate-name" };

  const id = randomUUID();
  const createdAt = new Date().toISOString();

  try {
    const result = await sql<FolderRow>`
      INSERT INTO folders (id, user_id, name, created_at)
      VALUES (${id}::uuid, ${userId}::uuid, ${normalizedName}, ${createdAt}::timestamptz)
      RETURNING id, name, created_at
    `;

    return { kind: "ok", folder: mapFolderRow(result.rows[0]) };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505") {
      return { kind: "duplicate-name" };
    }
    throw error;
  }
}

export async function removeFolderById(userId: string, id: string) {
  await ensureSchema();

  const result = await sql<Pick<FolderRow, "id">>`
    DELETE FROM folders
    WHERE id = ${id}::uuid
      AND user_id = ${userId}::uuid
    RETURNING id
  `;

  return Boolean(result.rows[0]);
}
