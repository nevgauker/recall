import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { formatWait } from '../lib/rate-limit'

/**
 * The counter is only worth having if it holds under concurrency: a
 * read-then-write limiter lets a burst of parallel requests all see "under the
 * limit" and all proceed. These tests run against a real database for that
 * reason, and like the ownership tests only when TEST_DATABASE_URL is set.
 */
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL

const requiresDatabase = TEST_DATABASE_URL
    ? {}
    : { skip: 'set TEST_DATABASE_URL to a disposable pgvector database to run this' }

async function load() {
    process.env.DATABASE_URL = TEST_DATABASE_URL
    const { prisma } = await import('../lib/prisma')
    const { consume } = await import('../lib/rate-limit')
    return { prisma, consume }
}

test('formatWait rounds up and pluralises', () => {
    assert.equal(formatWait(0), '1 second')
    assert.equal(formatWait(45), '45 seconds')
    assert.equal(formatWait(60), '1 minute')
    assert.equal(formatWait(61), '2 minutes')
    assert.equal(formatWait(3600), '1 hour')
    assert.equal(formatWait(5 * 3600 + 1), '6 hours')
})

test('a bucket admits exactly its limit, then refuses', requiresDatabase, async t => {
    const { prisma, consume } = await load()
    const key = `test:${randomUUID()}`
    t.after(async () => {
        await prisma.$executeRaw`DELETE FROM "RateLimitBucket" WHERE "key" = ${key}`
        await prisma.$disconnect()
    })

    // Fixed instant 100s into an hour-long window.
    const now = Date.UTC(2026, 0, 1, 12, 0, 0) + 100_000

    assert.equal((await consume(key, 2, 3600, now)).allowed, true)
    assert.equal((await consume(key, 2, 3600, now)).allowed, true)

    const refused = await consume(key, 2, 3600, now)
    assert.equal(refused.allowed, false)
    assert.equal(refused.retryAfterSeconds, 3500)

    // A refusal must not keep incrementing past the limit.
    const [{ count }] = await prisma.$queryRaw<{ count: number }[]>`
        SELECT "count" FROM "RateLimitBucket" WHERE "key" = ${key}
    `
    assert.equal(count, 2)

    // The next window starts empty.
    assert.equal((await consume(key, 2, 3600, now + 3600_000)).allowed, true)
})

test('concurrent requests cannot overshoot the limit', requiresDatabase, async t => {
    const { prisma, consume } = await load()
    const key = `test:${randomUUID()}`
    t.after(async () => {
        await prisma.$executeRaw`DELETE FROM "RateLimitBucket" WHERE "key" = ${key}`
        await prisma.$disconnect()
    })

    const now = Date.now()
    const results = await Promise.all(
        Array.from({ length: 20 }, () => consume(key, 5, 3600, now))
    )

    assert.equal(results.filter(r => r.allowed).length, 5)
})
