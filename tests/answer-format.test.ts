import test from 'node:test'
import assert from 'node:assert/strict'
import { parseAnswer, parseCitationGroup } from '../components/answer-format'

test('blank lines between numbered items keep one list', () => {
    // Models often separate list items with blank lines; each one used to
    // become its own <ol>, so the user saw "1. 1. 1.".
    const blocks = parseAnswer('Steps:\n\n1. Submit the form\n\n2. Wait for approval\n\n3. Book travel')
    assert.deepEqual(blocks, [
        { type: 'paragraph', text: 'Steps:' },
        { type: 'list', ordered: true, start: 1, items: ['Submit the form', 'Wait for approval', 'Book travel'] },
    ])
})

test('a list resumed after a paragraph keeps its numbering', () => {
    const blocks = parseAnswer('1. First\n2. Second\n\nA note.\n\n3. Third')
    assert.equal(blocks.length, 3)
    assert.deepEqual(blocks[2], { type: 'list', ordered: true, start: 3, items: ['Third'] })
})

test('switching between bullets and numbers starts a new list', () => {
    const blocks = parseAnswer('- a\n- b\n1. c')
    assert.deepEqual(
        blocks.map(b => (b.type === 'list' ? b.ordered : 'p')),
        [false, true]
    )
})

test('plain lines become paragraphs', () => {
    assert.deepEqual(parseAnswer('One.\nTwo.'), [
        { type: 'paragraph', text: 'One.' },
        { type: 'paragraph', text: 'Two.' },
    ])
})

test('repeated citation numbers collapse to one', () => {
    assert.deepEqual(parseCitationGroup('2, 2'), [2])
    assert.deepEqual(parseCitationGroup('1,3, 1'), [1, 3])
})
