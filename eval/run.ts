/**
 * Answer-quality evaluation against the sample handbook.
 *
 *   npm run eval                          # default answer model
 *   npm run eval -- --model gpt-4o-mini   # compare another model
 *
 * Uses the real pipeline (lib/ingest + lib/rag), DATABASE_URL and
 * OPENAI_API_KEY from .env. The handbook is ingested under a throwaway user id
 * and deleted afterwards, so nothing is left in the database and no real
 * user's documents can be retrieved. Costs a few cents per run, which is why it
 * is not part of CI.
 *
 * Writes a markdown report to eval/results/<model>.md.
 */
import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { prisma } from '../lib/prisma'
import { ingestDocument } from '../lib/ingest'
import { ANSWER_MODEL, DEFAULT_MIN_SIMILARITY, DEFAULT_TOP_K, answerQuestion } from '../lib/rag'
import { SAMPLE_DOCUMENT_CONTENT, SAMPLE_DOCUMENT_NAME } from '../lib/sample-document'
import { CASES, type EvalCase } from './handbook.cases'

/** USD per 1M tokens (input, output). List prices when written — check
 *  current pricing before quoting these numbers. */
const PRICES: Record<string, { input: number; output: number }> = {
    'gpt-4o': { input: 2.5, output: 10 },
    'gpt-4o-mini': { input: 0.15, output: 0.6 },
}

/** The model's own "not in the documents" reply, or the no-retrieval reply. */
const DECLINE = /couldn['’]t find/i
const CITATION = /\[\d+\]/

interface Result {
    case: EvalCase
    answer: string
    passed: boolean
    declined: boolean
    cited: boolean
    missing: string[]
    ms: number
    promptTokens: number
    completionTokens: number
}

function parseModel(argv: string[]): string {
    const i = argv.indexOf('--model')
    return i >= 0 && argv[i + 1] ? argv[i + 1] : ANSWER_MODEL
}

function grade(c: EvalCase, answer: string) {
    const declined = DECLINE.test(answer)
    if (c.expect === 'decline') {
        return { passed: declined, declined, missing: [] as string[] }
    }
    const missing = c.mustInclude.filter(p => !new RegExp(p, 'i').test(answer))
    return { passed: !declined && missing.length === 0, declined, missing }
}

const pct = (n: number, d: number) => (d === 0 ? 'n/a' : `${Math.round((100 * n) / d)}%`)
const oneLine = (s: string) => s.replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim()

function report(model: string, chunkCount: number, results: Result[]): string {
    const answerable = results.filter(r => r.case.expect === 'answer')
    const unanswerable = results.filter(r => r.case.expect === 'decline')
    const answered = results.filter(r => !r.declined)

    const promptTokens = results.reduce((n, r) => n + r.promptTokens, 0)
    const completionTokens = results.reduce((n, r) => n + r.completionTokens, 0)
    const price = PRICES[model]
    const costPerQuestion = price
        ? `$${((promptTokens * price.input + completionTokens * price.output) / 1e6 / results.length).toFixed(4)}`
        : 'n/a (no price on file)'
    const latencies = results.map(r => r.ms).sort((a, b) => a - b)
    const median = latencies[Math.floor(latencies.length / 2)]

    const lines = [
        `# Eval: ${model}`,
        '',
        `${new Date().toISOString().slice(0, 10)} · ${results.length} questions · sample handbook (${chunkCount} chunks) · top-k ${DEFAULT_TOP_K}, min similarity ${DEFAULT_MIN_SIMILARITY}`,
        '',
        '| Metric | Result |',
        '|---|---|',
        `| Correct answers (answerable questions) | ${answerable.filter(r => r.passed).length} / ${answerable.length} (${pct(answerable.filter(r => r.passed).length, answerable.length)}) |`,
        `| Correctly declined (not in the document) | ${unanswerable.filter(r => r.passed).length} / ${unanswerable.length} (${pct(unanswerable.filter(r => r.passed).length, unanswerable.length)}) |`,
        `| False refusals (declined an answerable question) | ${answerable.filter(r => r.declined).length} |`,
        `| Answers citing a source | ${pct(answered.filter(r => r.cited).length, answered.length)} |`,
        `| Median latency | ${(median / 1000).toFixed(1)}s |`,
        `| Cost per question (answer model) | ${costPerQuestion} |`,
        '',
        '## Cases',
        '',
        '| | Case | Question | Answer |',
        '|---|---|---|---|',
        ...results.map(r => {
            const note = r.missing.length ? ` _(missing: ${r.missing.map(m => `\`${m}\``).join(', ')})_` : ''
            return `| ${r.passed ? '✅' : '❌'} | ${r.case.id} | ${oneLine(r.case.question)} | ${oneLine(r.answer)}${note} |`
        }),
        '',
    ]
    return lines.join('\n')
}

async function main() {
    const model = parseModel(process.argv.slice(2))
    const userId = `eval-${randomUUID()}`
    const results: Result[] = []

    try {
        const { chunkCount } = await ingestDocument(userId, SAMPLE_DOCUMENT_CONTENT, SAMPLE_DOCUMENT_NAME, 'text')
        console.log(`Ingested sample (${chunkCount} chunks). Running ${CASES.length} cases on ${model}...\n`)

        // Sequential on purpose: latency numbers stay comparable and the run
        // stays well inside API rate limits.
        for (const c of CASES) {
            const started = performance.now()
            const { answer, usage } = await answerQuestion({ userId, question: c.question, model })
            const ms = performance.now() - started

            const { passed, declined, missing } = grade(c, answer)
            results.push({
                case: c,
                answer,
                passed,
                declined,
                cited: CITATION.test(answer),
                missing,
                ms,
                promptTokens: usage?.promptTokens ?? 0,
                completionTokens: usage?.completionTokens ?? 0,
            })
            console.log(`${passed ? 'PASS' : 'FAIL'}  ${c.id}${missing.length ? `  (missing ${missing.join(', ')})` : ''}`)
        }

        const markdown = report(model, chunkCount, results)
        const outDir = path.join(__dirname, 'results')
        mkdirSync(outDir, { recursive: true })
        const outFile = path.join(outDir, `${model}.md`)
        writeFileSync(outFile, markdown)

        const summary = markdown.split('## Cases')[0]
        console.log(`\n${summary.trim()}\n\nFull report: ${path.relative(process.cwd(), outFile)}`)
    } finally {
        await prisma.document.deleteMany({ where: { userId } })
        await prisma.$disconnect()
    }

    if (results.some(r => !r.passed)) process.exitCode = 1
}

main().catch(error => {
    console.error(error)
    process.exit(1)
})
