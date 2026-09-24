import test from 'node:test'
import assert from 'node:assert/strict'
import { splitIntoChunks } from '../lib/ingest'

test('splits with the requested overlap', () => {
    const words = Array.from({ length: 25 }, (_, i) => `w${i}`).join(' ')
    const chunks = splitIntoChunks(words, 10, 2)

    assert.equal(chunks[0].split(' ')[0], 'w0')
    // stride = size - overlap = 8, so the second chunk restarts at w8.
    assert.equal(chunks[1].split(' ')[0], 'w8')
    assert.ok(chunks.length >= 3)
})

test('terminates when overlap is >= chunk size', () => {
    // The old loop advanced by `size - overlap`; a non-positive stride spun
    // forever and pinned the request. The stride is now floored at 1.
    const chunks = splitIntoChunks('a b c d e', 3, 3)
    assert.ok(chunks.length > 0)
    assert.ok(chunks.length <= 5)

    const wider = splitIntoChunks('a b c d e', 3, 10)
    assert.ok(wider.length > 0 && wider.length <= 5)
})

test('drops empty and whitespace-only output', () => {
    assert.deepEqual(splitIntoChunks(''), [])
    assert.deepEqual(splitIntoChunks('   \n\t  '), [])
})

test('clamps a single unbroken run of characters', () => {
    const chunks = splitIntoChunks('x'.repeat(50_000), 500, 50)
    assert.ok(chunks.length > 0)
    for (const chunk of chunks) {
        assert.ok(chunk.length <= 8_000, `chunk of ${chunk.length} chars exceeds the cap`)
    }
})

test('collapses runs of whitespace rather than emitting empty words', () => {
    const chunks = splitIntoChunks('alpha    beta\n\n\ngamma', 2, 0)
    assert.deepEqual(chunks, ['alpha beta', 'gamma'])
})
