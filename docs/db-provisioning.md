# Provisioning a database for Recall

How to point Recall at a new Postgres/Supabase project and verify it came up
correctly. Follow this when standing up a new environment, or when recovering
from a lost database.

Recall stores embeddings in `pgvector` and depends on an HNSW index that Prisma
cannot see. Most of the care below exists because of that one fact — read
[CLAUDE.md](../CLAUDE.md) alongside this.

## Before you start

Provisioning a new project is a clean start, not a migration: previously
ingested documents and embeddings do not come with you, and users re-upload.
Clerk is unaffected — user ids survive, they simply own no documents yet.

## 1. Create the project

Supabase dashboard -> New project. The region is not load-bearing; nothing in
the repo depends on it.

## 2. Put `DATABASE_URL` in `.env`, not `.env.local`

`prisma.config.ts` does `import "dotenv/config"`, which loads **only `.env`**.
Next.js loads both, so a URL placed in `.env.local` works at runtime while the
Prisma CLI silently falls back to the `postgresql://localhost/dummy` default in
`prisma.config.ts`. That failure mode looks like migrations targeting nothing.

Use the **session-mode** pooler string — port `5432`, not `6543`. Transaction
mode breaks migrations. From the dashboard's Connect -> ORMs panel:

```
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-1-<region>.pooler.supabase.com:5432/postgres
```

`.gitignore` covers `.env*`, so the password stays out of version control.

## 3. Confirm the database is reachable and empty

```powershell
npx prisma migrate status
```

It should name the new host and report both migrations as not yet applied.

A `FATAL: (ENOTFOUND) tenant/user postgres.<ref> not found` means the project
ref or password is wrong, or the project no longer exists. Stop here — nothing
below will work. To tell a bad credential apart from a dead project, resolve the
direct host: if `db.<ref>.supabase.co` is NXDOMAIN, the project itself is gone.

## 4. Apply migrations with `deploy`

```powershell
npx prisma migrate deploy
```

**Use `deploy`. Never `migrate dev` or `db push` here.** `migrate dev` reads the
HNSW index as drift and will offer a migration that drops it.

On a fresh database `0_init` genuinely executes — it creates the `vector`
extension and both tables. (On the original database it was marked applied by
hand with `migrate resolve --applied 0_init`, since the schema predated
migrations.) `20260909000100` then adds `Document.userId`, the two btree
indexes, and the HNSW index.

If `0_init` fails with `type "vector" does not exist`, pgvector is present but
installed into a schema outside your `search_path`. In the SQL Editor run
`CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;` and re-run deploy.

## 5. Verify the HNSW index

Do not skip this. A missing index is silent: similarity search still returns
correct results, just via a sequential scan over every chunk.

```powershell
psql $env:DATABASE_URL -c "SELECT indexdef FROM pg_indexes WHERE indexname = 'DocumentChunk_embedding_hnsw_idx';"
```

Expect exactly one row, with opclass `vector_cosine_ops` — that is what matches
the `<=>` operator in `lib/rag.ts`. Zero rows means step 4 did not fully apply.

## 6. Confirm the only drift is the expected kind

```powershell
npx prisma migrate diff --from-config-datasource --to-schema-datamodel prisma/schema.prisma --script
```

The expected output is a lone `DROP INDEX "DocumentChunk_embedding_hnsw_idx";`,
which is Prisma being unable to model the index on an `Unsupported` column.
**Anything else in that output is real drift** — the database does not match
`schema.prisma`, and you should reconcile before shipping.

## 7. Smoke test end to end

```powershell
npm run dev
```

Sign in, upload a small text document, ask a question about it. That exercises
Clerk -> `requireUserId()` -> embed -> insert -> the ownership-joined search in
a single pass.

If the answer comes back as "I couldn't find anything relevant", ingestion
failed rather than retrieval — look for the `Ingest error:` line from
`app/api/ingest/route.ts` in the server log.

## 8. Update the deployed environment

The deploy is dashboard-connected (no `wrangler.toml` or adapter config in the
repo), so `DATABASE_URL` must be updated there separately or the deployed app
keeps pointing at the old database.

`npm run build` is only `prisma generate && next build` — **it does not apply
migrations**. Run `npx prisma migrate deploy` against the new database as a
release step or manually once.

## Writing SQL files on Windows

PowerShell 5.1's `Out-File -Encoding utf8` emits a BOM that Postgres rejects
(`syntax error at or near "DELETE"`). Use `Set-Content -Encoding Ascii`.
