import { randomUUID } from "node:crypto";
import { sql } from "@vercel/postgres";

type RawUserRow = {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
};

let schemaReadyPromise: Promise<void> | null = null;

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function ensureSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          auth_provider_user_id TEXT UNIQUE,
          name TEXT,
          avatar_url TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS folders (
          id UUID PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL
        )
      `;

      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS folders_user_lower_name_unique
        ON folders (user_id, LOWER(name))
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS images (
          id UUID PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,
          src TEXT NOT NULL,
          blob_path TEXT NOT NULL UNIQUE,
          width INTEGER NOT NULL,
          height INTEGER NOT NULL,
          title TEXT NOT NULL DEFAULT '',
          labels TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
          mime_type TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL,
          filename TEXT NOT NULL,
          canvas JSONB
        )
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS images_user_created_at_idx
        ON images (user_id, created_at DESC)
      `;

      await sql`
        CREATE INDEX IF NOT EXISTS images_user_folder_idx
        ON images (user_id, folder_id)
      `;
    })();
  }

  await schemaReadyPromise;
}

export async function upsertAuthUser(input: {
  email: string;
  name?: string | null;
  image?: string | null;
  providerUserId?: string | null;
}) {
  await ensureSchema();

  const email = normalizeEmail(input.email);
  const name = input.name?.trim() || null;
  const avatarUrl = input.image?.trim() || null;
  const providerUserId = input.providerUserId?.trim() || null;

  const insertedId = randomUUID();

  const result = await sql<Pick<RawUserRow, "id">>`
    INSERT INTO users (id, email, auth_provider_user_id, name, avatar_url)
    VALUES (${insertedId}::uuid, ${email}, ${providerUserId}, ${name}, ${avatarUrl})
    ON CONFLICT (email) DO UPDATE
    SET auth_provider_user_id = COALESCE(EXCLUDED.auth_provider_user_id, users.auth_provider_user_id),
        name = COALESCE(EXCLUDED.name, users.name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url)
    RETURNING id
  `;

  return result.rows[0]?.id ?? insertedId;
}

export async function findUserIdByEmail(email: string) {
  await ensureSchema();
  const result = await sql<Pick<RawUserRow, "id">>`
    SELECT id
    FROM users
    WHERE email = ${normalizeEmail(email)}
    LIMIT 1
  `;
  return result.rows[0]?.id ?? null;
}

export async function getUserById(id: string) {
  await ensureSchema();
  const result = await sql<RawUserRow>`
    SELECT id, email, name, avatar_url
    FROM users
    WHERE id = ${id}::uuid
    LIMIT 1
  `;
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    image: row.avatar_url,
  };
}
