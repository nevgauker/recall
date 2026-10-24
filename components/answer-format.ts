/**
 * Parse a model answer into paragraphs and lists — the subset of markdown the
 * model actually uses. Pure, so it can be tested without rendering.
 */

export type AnswerBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; start: number; items: string[] }

const BULLET = /^\s*[-*•]\s+(.*)$/
const NUMBERED = /^\s*(\d+)[.)]\s+(.*)$/

export function parseAnswer(text: string): AnswerBlock[] {
  const blocks: AnswerBlock[] = []
  let list: Extract<AnswerBlock, { type: 'list' }> | null = null

  const flush = () => {
    if (list) blocks.push(list)
    list = null
  }

  for (const line of text.split('\n')) {
    // A blank line does not end a list: models often write "1. a\n\n2. b",
    // and ending the list there renders every item as its own "1.".
    if (!line.trim()) continue

    const bullet = line.match(BULLET)
    const numbered = line.match(NUMBERED)
    if (bullet || numbered) {
      const ordered = !!numbered
      if (list && list.ordered !== ordered) flush()
      // Keep the model's own starting number, so a list resumed after a
      // paragraph ("3. …") isn't renumbered from 1.
      list ??= { type: 'list', ordered, start: numbered ? Number(numbered[1]) : 1, items: [] }
      list.items.push(bullet ? bullet[1] : numbered![2])
      continue
    }

    flush()
    blocks.push({ type: 'paragraph', text: line })
  }
  flush()

  return blocks
}

/** "[1, 1, 3]" → [1, 3]: a repeated number is one citation, not two. */
export function parseCitationGroup(group: string): number[] {
  return [...new Set(group.split(',').map(n => Number(n.trim())))]
}
