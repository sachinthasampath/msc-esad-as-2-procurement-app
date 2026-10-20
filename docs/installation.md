# Installation

## Prerequisites

- Node.js 20 or newer
- npm 10 (the repo declares `packageManager` `npm@10.9.8`)

Git is only needed if you are cloning the project. The database is SQLite, created on your machine. You do not install Postgres or MySQL.

## Install dependencies

From the repository root (`app/`):

```bash
npm install
```

That installs the workspace: `apps/web`, `apps/pwa`, `packages/domain`, `packages/db`, and `packages/ui`.

## Create the database

```bash
npm run db:setup
```

This does two things:

1. `prisma db push` creates or updates `packages/db/prisma/dev.db` from `packages/db/prisma/schema.prisma`.
2. `packages/db/src/seed.ts` loads the demo sites, catalogue, users, requisitions, purchase orders, invoices, and the default approval limits (Rs. 10,000 and Rs. 100,000).

The env files are already in the repo:

| File | Purpose |
| --- | --- |
| `packages/db/.env` | `DATABASE_URL="file:./dev.db"` for Prisma, relative to the schema folder |
| `apps/web/.env` | same database, plus `PWA_ORIGIN="http://localhost:3001"` for API CORS |
| `apps/pwa/.env.local` | `NEXT_PUBLIC_API_URL=http://localhost:3000` |

Do not point the two apps at different database files. The phone app has no database of its own. It uses the office app’s API.

## Reset demo data

```bash
npm run db:seed
```

Seeding again fills the same demo records. It does not drop tables you added by hand. To start from an empty file, stop the dev servers, delete `packages/db/prisma/dev.db`, and run `npm run db:setup` again.

Next: [Running](running.md).
