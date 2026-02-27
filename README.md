# The Board v3

The Board v3 is a private moodboard app with:

- Google sign-in (Auth.js / NextAuth v5)
- Per-user data isolation
- Cloud image storage in Vercel Blob
- Metadata in Vercel Postgres-compatible SQL

## Prerequisites

- Node.js 20+
- A Vercel project with:
  - Blob enabled
  - Postgres (or Neon connection string compatible with `@vercel/postgres`)
- Google OAuth credentials

## Environment Variables

Copy `.env.example` to `.env.local` and fill values:

```bash
cp .env.example .env.local
```

Required:

- `AUTH_SECRET` (or `NEXTAUTH_SECRET`)
- `AUTH_GOOGLE_ID` + `AUTH_GOOGLE_SECRET` (or `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`)
- `POSTGRES_URL` (plus optional related Postgres vars if provided by Vercel)
- `BLOB_READ_WRITE_TOKEN`

Google OAuth callback URL in Google Cloud Console:

- `https://<your-vercel-domain>/api/auth/callback/google`

## Install

```bash
npm i
```

## Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## One-Time Migration (local files -> cloud)

This imports existing `data/images.json` and `public/uploads/*` into cloud storage and SQL for one user.

```bash
npm run migrate:local-to-cloud -- --email your-google-email@example.com
```

What it does:

1. Upserts user by email
2. Migrates folders
3. Uploads local images to Blob
4. Inserts image metadata into SQL
5. Skips already-migrated image IDs
6. Prints migrated/skipped/failed counts

## Build

```bash
npm run lint
npm run build
```

## Deploy

Deploy to Vercel after setting all environment variables in the Vercel project settings.
