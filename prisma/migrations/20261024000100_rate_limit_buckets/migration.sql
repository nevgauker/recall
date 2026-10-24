-- Usage counters for lib/rate-limit.ts.
--
-- One row per (bucket key, fixed window). "windowStart" is Unix seconds rather
-- than a timestamp so the value the app computes and the value stored can never
-- disagree through a session time zone.

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "windowStart" BIGINT NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key","windowStart")
);

-- CreateIndex: expired buckets are swept by windowStart.
CREATE INDEX "RateLimitBucket_windowStart_idx" ON "RateLimitBucket"("windowStart");
