import { prisma } from './prisma'
import { AppError } from './errors'

/**
 * Usage limits for the two endpoints that spend money.
 *
 * Every question is an embedding call plus a chat completion, and every upload
 * embeds up to MAX_CHUNKS_PER_DOCUMENT chunks — all billed to the deployment's
 * OpenAI key. Without limits, any account that can sign up can run that bill
 * up without bound.
 *
 * Counters live in Postgres rather than Redis so a deployment needs no extra
 * infrastructure. Windows are fixed (aligned to the hour / UTC day), which
 * allows up to twice a limit across a window boundary; that is fine for cost
 * control and keeps each check to a single statement.
 */

export type LimitedAction = 'query' | 'ingest'

const HOUR = 60 * 60
const DAY = 24 * HOUR

export const MAX_DOCUMENTS_PER_USER = 50

interface Rule {
    scope: 'user' | 'global'
    limit: number
    windowSeconds: number
}

/** Per-user rules first: they are the ones normally hit, and a rejection
 *  there should not consume from the shared global budget. */
export const RULES: Record<LimitedAction, Rule[]> = {
    query: [
        { scope: 'user', limit: 30, windowSeconds: HOUR },
        { scope: 'user', limit: 150, windowSeconds: DAY },
        // Backstop for a public demo: caps total spend however many accounts
        // sign up.
        { scope: 'global', limit: 2_000, windowSeconds: DAY },
    ],
    ingest: [
        { scope: 'user', limit: 10, windowSeconds: HOUR },
        { scope: 'user', limit: 30, windowSeconds: DAY },
        { scope: 'global', limit: 300, windowSeconds: DAY },
    ],
}

const NOUNS: Record<LimitedAction, string> = { query: 'questions', ingest: 'uploads' }

/** Buckets older than this are deleted; must exceed the longest window. */
const RETENTION_SECONDS = 2 * DAY
const CLEANUP_PROBABILITY = 0.01

export interface ConsumeResult {
    allowed: boolean
    /** Seconds until the current window ends. */
    retryAfterSeconds: number
}

/**
 * Take one unit from a bucket, if any remain.
 *
 * The increment and the limit check are one statement: the conditional
 * ON CONFLICT update only fires while count < limit, so concurrent requests
 * cannot both read "29" and both proceed past a limit of 30. No row returned
 * means the bucket was already full.
 */
export async function consume(
    key: string,
    limit: number,
    windowSeconds: number,
    nowMs = Date.now()
): Promise<ConsumeResult> {
    const nowSeconds = Math.floor(nowMs / 1000)
    const windowStart = Math.floor(nowSeconds / windowSeconds) * windowSeconds
    const retryAfterSeconds = windowStart + windowSeconds - nowSeconds

    const rows = await prisma.$queryRaw<{ count: number }[]>`
        INSERT INTO "RateLimitBucket" ("key", "windowStart", "count")
        VALUES (${key}, ${windowStart}, 1)
        ON CONFLICT ("key", "windowStart")
        DO UPDATE SET "count" = "RateLimitBucket"."count" + 1
        WHERE "RateLimitBucket"."count" < ${limit}
        RETURNING "count"
    `

    return { allowed: rows.length > 0, retryAfterSeconds }
}

/** "4 minutes", "1 hour" — rounded up, so the user is never told too early. */
export function formatWait(seconds: number): string {
    const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`
    if (seconds < 60) return plural(Math.max(1, seconds), 'second')
    if (seconds < HOUR) return plural(Math.ceil(seconds / 60), 'minute')
    return plural(Math.ceil(seconds / HOUR), 'hour')
}

function periodName(windowSeconds: number): string {
    return windowSeconds === HOUR ? 'hour' : windowSeconds === DAY ? 'day' : `${windowSeconds} seconds`
}

/**
 * Throw a 429 if this user, or the deployment as a whole, has used up its
 * allowance for `action`. Call before doing any billable work.
 *
 * A rejection by a later rule still counts against the earlier ones; with the
 * rules ordered narrowest-first that only happens once the global budget is
 * exhausted, when it no longer matters.
 */
export async function enforceRateLimit(userId: string, action: LimitedAction): Promise<void> {
    if (Math.random() < CLEANUP_PROBABILITY) {
        const cutoff = Math.floor(Date.now() / 1000) - RETENTION_SECONDS
        await prisma.$executeRaw`DELETE FROM "RateLimitBucket" WHERE "windowStart" < ${cutoff}`
    }

    for (const rule of RULES[action]) {
        // The window length is part of the key: an hourly and a daily window
        // share a start time at midnight and must not share a counter.
        const key =
            rule.scope === 'user'
                ? `user:${userId}:${action}:${rule.windowSeconds}`
                : `global:${action}:${rule.windowSeconds}`

        const { allowed, retryAfterSeconds } = await consume(key, rule.limit, rule.windowSeconds)
        if (allowed) continue

        const wait = formatWait(retryAfterSeconds)
        const message =
            rule.scope === 'user'
                ? `You've reached the limit of ${rule.limit} ${NOUNS[action]} per ${periodName(rule.windowSeconds)}. Try again in ${wait}.`
                : `This demo has reached its daily limit for ${NOUNS[action]}. Try again in ${wait}.`

        throw new AppError(message, 429, { 'Retry-After': String(retryAfterSeconds) })
    }
}

/**
 * Cap how many documents one user can keep. Checked before the rate limit so
 * a user at the cap doesn't burn upload allowance on requests that will fail.
 *
 * Two concurrent uploads at the cap can both pass and land one over; the cap
 * bounds storage, it doesn't need to be exact.
 */
export async function enforceDocumentCap(userId: string): Promise<void> {
    const count = await prisma.document.count({ where: { userId } })
    if (count >= MAX_DOCUMENTS_PER_USER) {
        throw new AppError(
            `You can keep up to ${MAX_DOCUMENTS_PER_USER} documents. Delete one to add another.`,
            403
        )
    }
}
