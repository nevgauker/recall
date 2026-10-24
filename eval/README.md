# Evaluation

`npm run eval` runs the real retrieve-then-answer pipeline over
[handbook.cases.ts](handbook.cases.ts): 29 questions against the sample handbook
(`lib/sample-document.ts`):

- **23 answerable.** 18 direct lookups and 5 that need reasoning over the text,
  such as prorating vacation or applying an expense threshold.
- **6 unanswerable.** One rests on a false premise (an office that doesn't
  exist). The correct response is to decline.

Grading is deterministic. Because we wrote the document, every expected fact is
known, so an answer passes when it doesn't decline and matches the case's
patterns. No model grades another model.

```bash
npm run eval                          # gpt-4o (default)
npm run eval -- --model gpt-4o-mini
```

Each run ingests the handbook under a throwaway user, deletes it afterwards, and
writes `results/<model>.md`. It costs a few cents and needs real keys, so it runs
by hand rather than in CI. Run it after any change to chunking, retrieval
settings, the prompt or the model.

## Current results

| | gpt-4o | gpt-4o-mini |
|---|---|---|
| Correct answers (answerable questions) | **23 / 23** | 22 / 23 |
| Correctly declined | **6 / 6** | **6 / 6** |
| False refusals | 0 | 0 |
| Answers citing a source | 100% | 100% |
| Median latency | 1.2s | 1.0s |
| Cost per question | $0.0032 | $0.0002 |

Full per-question answers: [gpt-4o](results/gpt-4o.md), [gpt-4o-mini](results/gpt-4o-mini.md).

**Model choice.** gpt-4o-mini costs about 1/15th as much and matches gpt-4o on
every lookup and every refusal. It failed the one question that needs
arithmetic: asked about vacation for someone starting on 1 October, it confidently
answered 18.75 days instead of 6.25. gpt-4o stays the default. For a corpus that
is only lookups, mini would be the better choice, and this eval is how you'd
check that.

## What the eval caught

The first run, with 500-word chunks, scored 22/23 on answerable questions:

- *"I was sick for five days. Do I need a doctor's note?"* retrieved **nothing**,
  so the user got "I couldn't find anything relevant", even though the handbook
  answers it directly. A similar question about two days passed.
- Cause: a short sick-leave paragraph inside a 500-word chunk dilutes that
  chunk's embedding. The best match scored exactly 0.200, the
  `DEFAULT_MIN_SIMILARITY` cutoff, and fell just below it.

Best match scores by chunk size, measured before changing anything:

| Chunk size | Chunks | Weakest answerable question | Sick-leave question |
|---|---|---|---|
| 500 | 3 | 0.200 | 0.200 (missed) |
| 300 | 5 | 0.272 | 0.311 |
| **200** | 7 | 0.260 | 0.365 |
| 120 | 13 | 0.296 | 0.406 |

At every size, some unanswerable questions scored *higher* than some answerable
ones. The cutoff can't tell the two apart. Its only job is to drop clearly
irrelevant text, and real questions need to clear it with room to spare.
Declining belongs to the model, which got 6/6 at every setting tested.

Chunks are now 200 words with a 40-word overlap: 23/23, with less text sent per
answer.

(The first run also failed one correct answer, "a two-month notice", because the
pattern only accepted "two months". The grader was fixed, not the model.)

## Limits of this eval

- **One document, seven chunks.** Retrieval here mostly means "rank these seven".
  A corpus of many similar documents tests retrieval much harder, and that's the
  next set to add.
- **Pattern grading checks facts, not tone or completeness.** An answer that
  includes the right number alongside something wrong would still pass. The full
  reports exist so a person can read every answer.
- **Single run at temperature 0.2.** Treat a one-question difference between
  runs as noise.
