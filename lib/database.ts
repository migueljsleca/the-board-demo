import { randomUUID } from "node:crypto";
import { sql } from "@vercel/postgres";
import { hashPassword, verifyPassword } from "@/lib/password";

type RawUserRow = {
  id: string;
  email: string;
  username: string | null;
  password_hash: string | null;
  name: string | null;
  avatar_url: string | null;
};

type RawLocalAuthRow = {
  id: string;
  username: string;
  password_hash: string;
  name: string | null;
  email: string;
  avatar_url: string | null;
};

let schemaReadyPromise: Promise<void> | null = null;

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function isValidUsername(value: string) {
  return /^[a-z0-9_]{3,32}$/.test(value);
}

function localEmailFromUsername(username: string) {
  return `${username}@local.invalid`;
}

export async function ensureSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          username TEXT,
          password_hash TEXT,
          auth_provider_user_id TEXT UNIQUE,
          name TEXT,
          avatar_url TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS username TEXT
      `;

      await sql`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS password_hash TEXT
      `;

      await sql`
        CREATE UNIQUE INDEX IF NOT EXISTS users_lower_username_unique
        ON users (LOWER(username))
        WHERE username IS NOT NULL
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

export async function createLocalUser(input: { username: string; password: string }) {
  await ensureSchema();

  const username = normalizeUsername(input.username);
  const password = input.password;
  if (!isValidUsername(username)) return null;
  if (password.length < 8) return null;

  const insertedId = randomUUID();
  const passwordHash = await hashPassword(password);
  const email = localEmailFromUsername(username);

  try {
    const result = await sql<Pick<RawUserRow, "id">>`
      INSERT INTO users (id, email, username, password_hash, name)
      VALUES (${insertedId}::uuid, ${email}, ${username}, ${passwordHash}, ${username})
      RETURNING id
    `;
    return result.rows[0]?.id ?? insertedId;
  } catch (error: unknown) {
    const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: string }).code) : null;
    if (code === "23505") return null;
    throw error;
  }
}

export async function authenticateLocalUser(input: { username: string; password: string }) {
  await ensureSchema();

  const username = normalizeUsername(input.username);
  if (!isValidUsername(username) || input.password.length === 0) return null;

  const result = await sql<RawLocalAuthRow>`
    SELECT id, username, password_hash, name, email, avatar_url
    FROM users
    WHERE LOWER(username) = LOWER(${username})
      AND password_hash IS NOT NULL
    LIMIT 1
  `;
  const row = result.rows[0];
  if (!row) return null;

  const isValid = await verifyPassword(input.password, row.password_hash);
  if (!isValid) return null;

  return {
    id: row.id,
    username: row.username,
    name: row.name,
    email: row.email,
    image: row.avatar_url,
  };
}

export async function getUserById(id: string) {
  await ensureSchema();
  const result = await sql<RawUserRow>`
    SELECT id, email, username, password_hash, name, avatar_url
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
