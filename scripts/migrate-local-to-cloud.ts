import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { put } from "@vercel/blob";
import { sql } from "@vercel/postgres";
import { ensureSchema, upsertAuthUser } from "../lib/database";
import type { BoardCanvasLayout } from "../lib/board-types";

type LegacyFolder = {
  id?: unknown;
  name?: unknown;
  createdAt?: unknown;
};

type LegacyImage = {
  id?: unknown;
  src?: unknown;
  width?: unknown;
  height?: unknown;
  title?: unknown;
  labels?: unknown;
  folderId?: unknown;
  createdAt?: unknown;
  filename?: unknown;
  mimeType?: unknown;
  canvas?: unknown;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertUuid(value: string) {
  return UUID_RE.test(value);
}

function normalizeLabel(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeLabels(input: unknown) {
  if (!Array.isArray(input)) return [];
  const unique = new Set<string>();
  for (const entry of input) {
    if (typeof entry !== "string") continue;
    const normalized = normalizeLabel(entry);
    if (!normalized) continue;
    unique.add(normalized);
  }
  return Array.from(unique).slice(0, 12);
}

function normalizeTitle(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, 120);
}

function normalizeCanvas(value: unknown): BoardCanvasLayout | null {
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

function safeDimension(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.round(parsed);
}

function normalizeCreatedAt(value: unknown) {
  if (typeof value !== "string") return new Date().toISOString();
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return new Date().toISOString();
  return new Date(timestamp).toISOString();
}

function extensionFromMime(mimeType: string) {
  const mime = mimeType.toLowerCase();
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  if (mime === "image/avif") return "avif";
  if (mime === "image/svg+xml") return "svg";
  return "bin";
}

async function main() {
  const args = parseArgs({
    options: {
      email: {
        type: "string",
      },
    },
  });

  const email = args.values.email?.trim();
  if (!email) {
    throw new Error("Usage: npm run migrate:local-to-cloud -- --email you@example.com");
  }

  await ensureSchema();

  const userId = await upsertAuthUser({ email, providerUserId: null });
  const dataPath = path.join(process.cwd(), "data", "images.json");
  const uploadsDir = path.join(process.cwd(), "public", "uploads");

  const raw = await fs.readFile(dataPath, "utf8");
  const parsed = JSON.parse(raw) as { images?: unknown; folders?: unknown };
  const legacyFolders = Array.isArray(parsed.folders) ? (parsed.folders as LegacyFolder[]) : [];
  const legacyImages = Array.isArray(parsed.images) ? (parsed.images as LegacyImage[]) : [];

  const folderIdMap = new Map<string, string>();
  let folderMigrated = 0;
  let folderSkipped = 0;

  for (const folder of legacyFolders) {
    const originalId = typeof folder.id === "string" ? folder.id : randomUUID();
    const normalizedName = typeof folder.name === "string" ? folder.name.trim().replace(/\s+/g, " ") : "";
    if (!normalizedName) {
      folderSkipped += 1;
      continue;
    }

    const existingByName = await sql<{ id: string }>`
      SELECT id
      FROM folders
      WHERE user_id = ${userId}::uuid
        AND LOWER(name) = ${normalizedName.toLowerCase()}
      LIMIT 1
    `;

    if (existingByName.rows[0]?.id) {
      folderIdMap.set(originalId, existingByName.rows[0].id);
      folderSkipped += 1;
      continue;
    }

    const folderId = assertUuid(originalId) ? originalId : randomUUID();
    const createdAt = normalizeCreatedAt(folder.createdAt);

    await sql`
      INSERT INTO folders (id, user_id, name, created_at)
      VALUES (${folderId}::uuid, ${userId}::uuid, ${normalizedName}, ${createdAt}::timestamptz)
      ON CONFLICT (id) DO NOTHING
    `;

    folderIdMap.set(originalId, folderId);
    folderMigrated += 1;
  }

  let imageMigrated = 0;
  let imageSkipped = 0;
  let imageFailed = 0;

  for (const image of legacyImages) {
    try {
      const originalId = typeof image.id === "string" ? image.id : randomUUID();
      const imageId = assertUuid(originalId) ? originalId : randomUUID();

      const alreadyExists = await sql<{ id: string }>`
        SELECT id
        FROM images
        WHERE id = ${imageId}::uuid
        LIMIT 1
      `;
      if (alreadyExists.rows[0]) {
        imageSkipped += 1;
        continue;
      }

      const filenameFromRecord = typeof image.filename === "string" && image.filename ? image.filename : null;
      const mimeType = typeof image.mimeType === "string" && image.mimeType ? image.mimeType : "application/octet-stream";
      const extension = filenameFromRecord
        ? path.extname(filenameFromRecord).replace(".", "") || extensionFromMime(mimeType)
        : extensionFromMime(mimeType);
      const filename = filenameFromRecord ?? `${imageId}.${extension}`;
      const localFilePath = path.join(uploadsDir, filename);

      let buffer: Buffer;
      try {
        buffer = await fs.readFile(localFilePath);
      } catch {
        imageFailed += 1;
        continue;
      }

      const blobPath = `users/${userId}/images/${filename}`;
      const upload = await put(blobPath, buffer, {
        access: "public",
        addRandomSuffix: false,
        contentType: mimeType,
      });

      const mappedFolderId =
        typeof image.folderId === "string" && image.folderId ? folderIdMap.get(image.folderId) ?? null : null;
      const normalizedCanvas = normalizeCanvas(image.canvas);
      const normalizedLabels = normalizeLabels(image.labels);
      const normalizedLabelsJson = JSON.stringify(normalizedLabels);

      await sql`
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
          ${imageId}::uuid,
          ${userId}::uuid,
          ${mappedFolderId}::uuid,
          ${upload.url},
          ${upload.pathname},
          ${safeDimension(image.width, 1200)},
          ${safeDimension(image.height, 1600)},
          ${normalizeTitle(image.title)},
          (
            SELECT COALESCE(ARRAY_AGG(value), ARRAY[]::text[])
            FROM JSONB_ARRAY_ELEMENTS_TEXT(${normalizedLabelsJson}::jsonb) AS value
          ),
          ${mimeType},
          ${normalizeCreatedAt(image.createdAt)}::timestamptz,
          ${filename},
          ${normalizedCanvas ? JSON.stringify(normalizedCanvas) : null}::jsonb
        )
      `;

      imageMigrated += 1;
    } catch {
      imageFailed += 1;
    }
  }

  console.log(`Migration completed for ${email}`);
  console.log(`Folders: migrated=${folderMigrated}, skipped=${folderSkipped}`);
  console.log(`Images: migrated=${imageMigrated}, skipped=${imageSkipped}, failed=${imageFailed}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Migration failed: ${message}`);
  process.exitCode = 1;
});
