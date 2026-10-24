# Deploying Recall to Vercel

Assumes the database already exists and is migrated — see
[db-provisioning.md](db-provisioning.md).

## 1. Migrate first, from your machine

Vercel's build runs `prisma generate && next build`; it never applies
migrations. Apply them before deploying code that needs them:

```bash
npm run db:deploy        # prisma migrate deploy — never `migrate dev` here
```

`migrate dev` would generate a migration dropping the HNSW index (see
CLAUDE.md). Afterwards, confirm the index is still there:

```sql
SELECT indexdef FROM pg_indexes WHERE indexname = 'DocumentChunk_embedding_hnsw_idx';
```

## 2. Import the project

Vercel dashboard -> **Add New -> Project** -> import `nevgauker/recall`. The
framework preset (Next.js) and build command from `package.json` need no
changes. Every push to `main` then deploys to production, and every PR gets a
preview URL.

## 3. Environment variables

Set these for **Production** (and **Preview** if you want PR previews to work):

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon's **pooled** endpoint (`-pooler` in the host) |
| `OPENAI_API_KEY` | A key with a monthly spend limit set in the OpenAI dashboard |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | From the Clerk dashboard |
| `CLERK_SECRET_KEY` | From the Clerk dashboard |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` |
| `NEXT_PUBLIC_CONTACT_URL` | Optional: your contact link for the landing page's "Get in touch" section. Unset hides it. Rebuild after changing � `NEXT_PUBLIC_` values are baked in at build time. |

**Why pooled here but unpooled locally:** serverless functions open a
connection per instance, which the pooler absorbs. Migrations can't run through
a transaction-mode pooler, but migrations only ever run from your machine, using
the unpooled URL in your local `.env`. The two copies of `DATABASE_URL` point at
the same database through different doors.

**Spend:** the app caps usage itself (`lib/rate-limit.ts`: per user and a
global daily backstop), but set a hard monthly limit on the OpenAI key too. The
app's limits protect against users; the key limit protects against a bug in the
app's limits.

## 4. Clerk

A Clerk **development** instance works on a `*.vercel.app` domain and is fine
for a demo, with two visible costs: a "Development mode" badge on the sign-in
page, and a cap on total users. A **production** instance removes both but
requires a domain you own, with DNS records Clerk provides. Moving to a custom
domain later means switching keys, nothing in code.

## 5. Smoke test

On the deployed URL:

1. Sign up.
2. Click **Load a sample employee handbook**.
3. Click a suggested question and check the answer cites a source.
4. Click "What is the CEO's salary?" — it should decline, with no sources.

Function time limits are set per route (`maxDuration`: 60s for ingest and the
sample, 30s for queries), within every Vercel plan's ceiling. A very large PDF
can still approach 60s; if uploads time out, that is the limit being hit.
