# The Board

The Board is a private visual moodboard built with Next.js. It is designed for collecting reference images fast, organizing them into boards, tagging them, and arranging them either in a masonry gallery or on a freeform canvas.

Live app: [the-board-ruby.vercel.app](https://the-board-ruby.vercel.app/)

## What It Does

- Creates local username/password accounts
- Stores users, boards, and image metadata in Postgres
- Stores uploaded image files in Vercel Blob
- Supports paste-to-upload image flow
- Organizes images into custom boards
- Adds and filters labels
- Includes search across boards and labels
- Switches between gallery view and canvas view
- Persists canvas position, size, and layering for each image

## Stack

- Next.js 16
- React 19
- Auth.js / NextAuth v5
- Vercel Postgres
- Vercel Blob
- Tailwind CSS 4
- TypeScript

## Project Structure

```text
app/
  page.tsx                 Main board UI
  sign-in/page.tsx         Sign-in page
  sign-up/page.tsx         Sign-up page
  api/                     Auth, viewer, images, folders
lib/
  database.ts              User and schema logic
  image-db.ts              Image and board persistence
scripts/
  migrate-local-to-cloud.ts
```

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Create local env file

```bash
cp .env.example .env.local
```

Required values:

- `AUTH_SECRET` or `NEXTAUTH_SECRET`
- `POSTGRES_URL`
- `BLOB_READ_WRITE_TOKEN`

Optional Postgres values can also be provided if your Vercel project generated them:

- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`
- `POSTGRES_USER`
- `POSTGRES_HOST`
- `POSTGRES_PASSWORD`
- `POSTGRES_DATABASE`

### 3. Start the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Auth Model

The current app uses local credentials auth, not Google OAuth.

- users sign up with a username and password
- passwords are stored as hashes
- sessions are handled through Auth.js
- user data is isolated per account

## Image Storage Model

When a user uploads or pastes an image:

1. The file is sent to the app
2. The binary image is stored in Vercel Blob
3. Metadata is written to Postgres
4. The board can later update labels, board assignment, title, and canvas layout

## Migration Script

This project includes a one-time migration for older local image data:

```bash
npm run migrate:local-to-cloud -- --email your-email@example.com
```

It:

1. upserts the target user
2. migrates folders
3. uploads local files to Blob
4. inserts metadata into SQL
5. skips already-migrated image IDs

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run migrate:local-to-cloud
```

## Deployment

The intended deployment target is Vercel.

Before deploying:

- connect the correct repo to the Vercel project
- make sure the correct root directory is selected for the app
- set production environment variables
- confirm the production domain is attached to the correct project

After that:

```bash
npm run build
```

Then deploy through Vercel.
