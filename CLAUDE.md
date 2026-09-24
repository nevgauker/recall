# Recall

## Database

Postgres (Supabase) with `pgvector`. Schema changes go through `prisma migrate`,
never `prisma db push` — see the index caveat below.

Provisioning a new database, or recovering a lost one, is documented in
[docs/db-provisioning.md](docs/db-provisioning.md).

### The HNSW index is invisible to Prisma

`DocumentChunk.embedding` is `Unsupported("vector(1536)")`, and Prisma cannot
model an `hnsw` / `vector_cosine_ops` index on an unsupported column. The index
therefore exists only in `prisma/migrations/20260909000100_user_scoping_and_vector_index/migration.sql`,
not in `schema.prisma`.

Prisma reads this as drift and wants to remove it:

```
$ prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
-- DropIndex
DROP INDEX "DocumentChunk_embedding_hnsw_idx";
```

So:

- **Do not accept** a generated migration that drops `DocumentChunk_embedding_hnsw_idx`.
- After any `migrate reset` or `db push`, recreate it:

  ```sql
  CREATE INDEX "DocumentChunk_embedding_hnsw_idx"
      ON "DocumentChunk" USING hnsw ("embedding" vector_cosine_ops);
  ```

Losing it is silent — similarity search still returns correct results, just via a
sequential scan over every chunk. Verify with:

```sql
SELECT indexdef FROM pg_indexes WHERE indexname = 'DocumentChunk_embedding_hnsw_idx';
```

The opclass must stay `vector_cosine_ops` to match the `<=>` operator used in
`lib/rag.ts`.

### Ownership

Every `Document` carries a Clerk `userId`. The retrieval query in `lib/rag.ts`
joins through `Document` and filters on `d."userId"` — chunks are never queried
unscoped. Route handlers get the id from `requireUserId()` in `lib/auth.ts`.

`20260909000100` backfilled pre-auth rows to a `'__preauth__'` sentinel; those
rows have since been deleted and the column default dropped, so every insert must
supply an owner explicitly.

## Writing SQL files on Windows

PowerShell 5.1's `Out-File -Encoding utf8` emits a BOM, which Postgres rejects
(`syntax error at or near "DELETE"`). Use `Set-Content -Encoding Ascii`.
