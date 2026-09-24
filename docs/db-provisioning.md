# Provisioning a database for Recall

How to point Recall at a new Postgres database and verify it came up correctly.
Follow this when standing up a new environment, when recovering from a lost
database, or when inheriting one you did not create.

Recall needs Postgres with `pgvector`, and depends on an HNSW index that Prisma
cannot see. Most of the care below exists because of that one fact — read
[CLAUDE.md](../CLAUDE.md) alongside this.

Any managed Postgres with pgvector works. Recall has run on Neon (current) and
Supabase; provider-specific details are called out where they differ.

## Already have a database? Verify, don't provision

If the database already exists, skip to step 5. `npx prisma migrate status`
reporting **"Database schema is up to date"** means only that
`_prisma_migrations` matches the migrations folder — it does *not* prove the
HNSW index survived, because Prisma cannot see that index at all. A database
restored from backup, reset, or built with `db push` can report itself up to
date while missing it. Run steps 5 and 6 anyway.

## Before you start

Provisioning a *new* project is a clean start, not a migration: previously
ingested documents and embeddings do not come with you, and users re-upload.
Clerk is unaffected — user ids survive, they simply own no documents yet.

## 1. Create the project

- **Neon** — console -> New project. Pick a region near your deploy.
- **Supabase** — dashboard -> New project.

Both ship pgvector; step 4 enables it.

## 2. Put `DATABASE_URL` in `.env`, not `.env.local`

`prisma.config.ts` does `import "dotenv/config"`, which loads **only `.env`**.
Next.js loads both, so a URL placed in `.env.local` works at runtime while the
Prisma CLI silently falls back to the `postgresql://localhost/dummy` default in
`prisma.config.ts`. That failure mode looks like migrations targeting nothing.

`.gitignore` covers `.env*`, so credentials stay out of version control.

### Pooled or unpooled?

Recall reads a **single** `DATABASE_URL` — `lib/prisma.ts` takes one connection
string and `schema.prisma` has no `directUrl`. That one URL has to serve both
the app and `prisma migrate`, which decides the answer:

- **Neon** — use the **unpooled** endpoint (no `-pooler` in the hostname). The
  pooled endpoint is PgBouncer in transaction mode, which migrations cannot use.

  ```
  DATABASE_URL="postgresql://<user>:<password>@ep-<id>.<region>.aws.neon.tech/neondb?sslmode=require"
  ```

- **Supabase** — use the **session-mode pooler**, port `5432` (not `6543`, which
  is transaction mode and breaks migrations). The username is `postgres.<ref>`,
  not plain `postgres`. Avoid the direct `db.<ref>.supabase.co` host: new
  projects are IPv6-only there without the IPv4 add-on.

  ```
  DATABASE_URL="postgresql://postgres.<ref>:<password>@aws-1-<region>.pooler.supabase.com:5432/postgres"
  ```

If you later outgrow one connection string — serverless runtimes open a
connection per instance, which is what pooled endpoints absorb — the fix is to
add a second variable and a `directUrl` to `schema.prisma`, pointing runtime at
the pooled host and migrations at the unpooled one. That is a code change, not
a config change.

**Percent-encode the password** if it contains `@ : / ? # [ ] %` — `@` -> `%40`,
`#` -> `%23`, `%` -> `%25`. An unencoded `@` splits the URL at the wrong place
and reports a confusing host error.

## 3. Confirm the database is reachable

```powershell
npx prisma migrate status
```

It should name the expected host. On a new project it reports migrations as not
yet applied; on an existing one, "up to date" (see the caveat at the top).

Reading the failures:

- **Supabase** `FATAL: (ENOTFOUND) tenant/user postgres.<ref> not found` — wrong
  ref or password, or the project is gone. To tell those apart, resolve
  `db.<ref>.supabase.co`: NXDOMAIN means the project itself no longer exists.
- **Neon** `password authentication failed` — wrong credentials. A connection
  that stalls before failing usually means a suspended compute; it wakes on the
  next attempt, so retry once before debugging.

Either way, stop here if it does not connect. Nothing below will work.

## 4. Apply migrations with `deploy`

```powershell
npx prisma migrate deploy
```

**Use `deploy`. Never `migrate dev` or `db push` here.** `migrate dev` reads the
HNSW index as drift and will offer a migration that drops it.

On a fresh database `0_init` genuinely executes — it creates the `vector`
extension and both tables. (On the original Supabase database it was marked
applied by hand with `migrate resolve --applied 0_init`, since the schema
predated migrations.) `20260909000100` then adds `Document.userId`, the two
btree indexes, and the HNSW index.

If `0_init` fails with `type "vector" does not exist`, pgvector is installed
into a schema outside your `search_path`. Run
`CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;` and re-run deploy.

## 5. Verify the HNSW index

Do not skip this, on a new or an inherited database. A missing index is silent:
similarity search still returns correct results, just via a sequential scan over
every chunk.

```powershell
psql $env:DATABASE_URL -c "SELECT indexdef FROM pg_indexes WHERE indexname = 'DocumentChunk_embedding_hnsw_idx';"
```

Expect exactly one row, with opclass `vector_cosine_ops` — that is what matches
the `<=>` operator in `lib/rag.ts`. Zero rows means recreate it:

```sql
CREATE INDEX "DocumentChunk_embedding_hnsw_idx"
    ON "DocumentChunk" USING hnsw ("embedding" vector_cosine_ops);
```

A fuller health check, worth running when inheriting a database:

```sql
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
SELECT indexname FROM pg_indexes WHERE tablename IN ('Document','DocumentChunk') ORDER BY indexname;
SELECT column_name, is_nullable, column_default FROM information_schema.columns
    WHERE table_name = 'Document' AND column_name = 'userId';
SELECT "userId", count(*) FROM "Document" GROUP BY 1 ORDER BY 2 DESC;
```

Expect pgvector present, five indexes, `userId` `NOT NULL` with **no** default,
and no rows owned by `__preauth__`. That sentinel marks pre-auth leftovers: no
real user can see them, and they should be deleted with `cleanup.sql`.

## 6. Confirm the only drift is the expected kind

```powershell
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
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
