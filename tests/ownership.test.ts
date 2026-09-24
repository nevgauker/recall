import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { EMBEDDING_DIMENSIONS } from '../lib/ingest'

/**
 * The ownership boundary, exercised against a real database.
 *
 * `similaritySearch` is the only place chunks are read, and the join on
 * Document is what stops one user's question being answered out of another
 * user's documents. That predicate is easy to drop by accident and nothing
 * else in the suite would notice, so this test asks the question directly:
 * given a neighbour that is a *better* match but belongs to someone else, does
 * the search return it?
 *
 * Runs only when TEST_DATABASE_URL is set, and deliberately ignores
 * DATABASE_URL — the test writes and deletes rows, so pointing it at a
 * development database has to be an explicit act.
 */
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL

const requiresDatabase = TEST_DATABASE_URL
    ? {}
    : { skip: 'set TEST_DATABASE_URL to a disposable pgvector database to run this' }

/** A unit vector along one axis, padded to the embedding width. */
function unitVector(axis: number): number[] {
    const values = new Array(EMBEDDING_DIMENSIONS).fill(0)
    values[axis] = 1
    return values
}

/** Halfway between two axes: cosine similarity 1/sqrt(2) with either one. */
function diagonalVector(a: number, b: number): number[] {
    const values = new Array(EMBEDDING_DIMENSIONS).fill(0)
    values[a] = Math.SQRT1_2
    values[b] = Math.SQRT1_2
    return values
}

test('similarity search never crosses the ownership boundary', requiresDatabase, async t => {
    // lib/prisma reads DATABASE_URL on first use, so this has to happen before
    // the import below, not at the top of the file.
    process.env.DATABASE_URL = TEST_DATABASE_URL

    const { prisma } = await import('../lib/prisma')
    const { similaritySearch } = await import('../lib/rag')

    const mine = `test-owner-${randomUUID()}`
    const theirs = `test-other-${randomUUID()}`
    const documentIds: string[] = []

    async function seed(userId: string, name: string, embedding: number[]) {
        const document = await prisma.document.create({
            data: { userId, name, sourceType: 'text' },
        })
        documentIds.push(document.id)

        // Raw insert: `embedding` is Unsupported("vector(1536)"), so Prisma's
        // typed client cannot write it.
        await prisma.$executeRaw`
            INSERT INTO "DocumentChunk" (id, "documentId", content, embedding, metadata)
            VALUES (
                ${randomUUID()},
                ${document.id},
                ${`content of ${name}`},
                ${JSON.stringify(embedding)}::vector,
                ${JSON.stringify({ source_name: name, chunk_index: 0 })}::jsonb
            )
        `
        return document.id
    }

    t.after(async () => {
        // Chunks go with the documents via ON DELETE CASCADE.
        await prisma.document.deleteMany({ where: { id: { in: documentIds } } })
        await prisma.$disconnect()
    })

    const query = unitVector(0)

    // The other user's chunk is an exact match for the query; mine is merely a
    // good one. If the join were dropped, theirs would rank first — so a
    // regression cannot hide behind ordering.
    await seed(theirs, 'their-document', unitVector(0))
    const mineId = await seed(mine, 'my-document', diagonalVector(0, 1))

    const results = await similaritySearch(mine, query, 10, 0.1)

    assert.equal(results.length, 1, 'expected exactly my own chunk')
    assert.equal(results[0].document_id, mineId)
    assert.equal(results[0].metadata.source_name, 'my-document')

    // Restate it as the security property, so a failure reads as what it is.
    assert.ok(
        results.every(chunk => chunk.document_id !== documentIds[0]),
        'similarity search returned a chunk belonging to another user'
    )
})

test('a user with no documents retrieves nothing', requiresDatabase, async t => {
    process.env.DATABASE_URL = TEST_DATABASE_URL

    const { prisma } = await import('../lib/prisma')
    const { similaritySearch } = await import('../lib/rag')

    const owner = `test-owner-${randomUUID()}`
    const stranger = `test-stranger-${randomUUID()}`

    const document = await prisma.document.create({
        data: { userId: owner, name: 'seeded', sourceType: 'text' },
    })

    await prisma.$executeRaw`
        INSERT INTO "DocumentChunk" (id, "documentId", content, embedding, metadata)
        VALUES (
            ${randomUUID()},
            ${document.id},
            'seeded content',
            ${JSON.stringify(unitVector(0))}::vector,
            ${JSON.stringify({ source_name: 'seeded', chunk_index: 0 })}::jsonb
        )
    `

    t.after(async () => {
        await prisma.document.delete({ where: { id: document.id } })
        await prisma.$disconnect()
    })

    // An empty result is the correct answer, not an error: the route turns it
    // into "I couldn't find anything relevant in your documents."
    const results = await similaritySearch(stranger, unitVector(0), 10, 0.1)
    assert.deepEqual(results, [])
})
