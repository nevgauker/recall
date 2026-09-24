-- Scope documents to a Clerk user and add the indexes the query path needs.

-- AlterTable: add userId.
-- Added WITH a default so the column can be NOT NULL on a table that already
-- has rows, then the default is dropped so every future insert must supply an
-- owner explicitly. Pre-existing documents predate authentication and have no
-- recoverable owner, so they are parked under a sentinel id and are invisible
-- to every real user. Delete them with:
--   DELETE FROM "Document" WHERE "userId" = '__preauth__';
ALTER TABLE "Document" ADD COLUMN "userId" TEXT NOT NULL DEFAULT '__preauth__';
ALTER TABLE "Document" ALTER COLUMN "userId" DROP DEFAULT;

-- CreateIndex: the document list is always "mine, newest first".
CREATE INDEX "Document_userId_createdAt_idx" ON "Document"("userId", "createdAt" DESC);

-- CreateIndex: the FK had no index, so cascading deletes and the ownership
-- join both sequentially scanned every chunk.
CREATE INDEX "DocumentChunk_documentId_idx" ON "DocumentChunk"("documentId");

-- CreateIndex: approximate nearest-neighbour index for similarity search.
-- Without it every query is a sequential scan over the whole chunk table.
-- vector_cosine_ops matches the `<=>` operator used by the query route.
CREATE INDEX "DocumentChunk_embedding_hnsw_idx"
    ON "DocumentChunk"
    USING hnsw ("embedding" vector_cosine_ops);
