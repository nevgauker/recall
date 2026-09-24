import OpenAI from 'openai'
import { prisma } from './prisma'
import { AppError } from './errors'
import { EMBEDDING_MODEL } from './ingest'

export const ANSWER_MODEL = 'gpt-4o'
export const DEFAULT_TOP_K = 5
export const DEFAULT_MIN_SIMILARITY = 0.2
export const NO_ANSWER_TEXT = "I couldn't find this in the uploaded documents."

/** How much prior conversation is forwarded to the model. */
const MAX_HISTORY_MESSAGES = 10
const MAX_HISTORY_CHARS = 4_000
const MAX_QUESTION_CHARS = 2_000

let openaiInstance: OpenAI | undefined

function getOpenAI(): OpenAI {
    if (!openaiInstance) {
        const apiKey = process.env.OPENAI_API_KEY
        if (!apiKey) {
            throw new Error('OPENAI_API_KEY environment variable is not set')
        }
        openaiInstance = new OpenAI({ apiKey })
    }
    return openaiInstance
}

export interface RetrievedChunk {
    id: string
    content: string
    metadata: { source_name: string; source_url?: string | null; chunk_index: number }
    document_id: string
    similarity: number
}

export interface Source {
    name: string
    excerpt: string
    similarity: number
}

export interface HistoryMessage {
    role: 'user' | 'assistant'
    content: string
}

export interface AnswerResult {
    answer: string
    sources: Source[]
    chunks: RetrievedChunk[]
}

/** Accept only well-formed history, and only a bounded amount of it. */
export function sanitizeHistory(raw: unknown): HistoryMessage[] {
    if (!Array.isArray(raw)) return []

    return raw
        .filter((m): m is HistoryMessage =>
            !!m &&
            typeof m === 'object' &&
            (('role' in m && (m.role === 'user' || m.role === 'assistant')) as boolean) &&
            'content' in m &&
            typeof (m as { content: unknown }).content === 'string'
        )
        .slice(-MAX_HISTORY_MESSAGES)
        .map(m => ({ role: m.role, content: m.content.slice(0, MAX_HISTORY_CHARS) }))
}

export async function embedQuery(text: string): Promise<number[]> {
    const response = await getOpenAI().embeddings.create({
        model: EMBEDDING_MODEL,
        input: text,
    })
    return response.data[0].embedding
}

/**
 * Nearest chunks belonging to this user.
 *
 * The join on Document is the access control: without it the search ranked
 * across every chunk in the table, so one user's question could be answered
 * out of another user's documents.
 */
export async function similaritySearch(
    userId: string,
    embedding: number[],
    limit = DEFAULT_TOP_K,
    minSimilarity = DEFAULT_MIN_SIMILARITY
): Promise<RetrievedChunk[]> {
    const vector = JSON.stringify(embedding)

    const results = await prisma.$queryRaw<RetrievedChunk[]>`
        SELECT
            c.id,
            c.content,
            c.metadata,
            c."documentId" AS document_id,
            1 - (c.embedding <=> ${vector}::vector) AS similarity
        FROM "DocumentChunk" c
        JOIN "Document" d ON d.id = c."documentId"
        WHERE d."userId" = ${userId}
          AND c.embedding IS NOT NULL
          AND 1 - (c.embedding <=> ${vector}::vector) >= ${minSimilarity}
        ORDER BY c.embedding <=> ${vector}::vector
        LIMIT ${limit}
    `

    return results
}

export function buildSystemPrompt(chunks: RetrievedChunk[]): string {
    const context = chunks
        .map((c, i) => `[${i + 1}] (Source: ${c.metadata.source_name})\n${c.content}`)
        .join('\n\n')

    return `You are a helpful knowledge assistant. Answer the question based only on the provided context.
If the answer is not in the context, say "${NO_ANSWER_TEXT}"
Always cite which source number(s) you used, e.g. [1], [2].

Context:
${context}`
}

/**
 * The full retrieve-then-answer pipeline.
 *
 * Deliberately independent of the HTTP layer so an evaluation harness can call
 * it directly with a fixed userId and compare answers across settings.
 */
export async function answerQuestion(options: {
    userId: string
    question: string
    history?: unknown
    topK?: number
    minSimilarity?: number
    model?: string
}): Promise<AnswerResult> {
    const question = options.question?.trim()
    if (!question) {
        throw new AppError('No question provided.')
    }
    if (question.length > MAX_QUESTION_CHARS) {
        throw new AppError(`Questions must be ${MAX_QUESTION_CHARS} characters or fewer.`)
    }

    const embedding = await embedQuery(question)
    const chunks = await similaritySearch(
        options.userId,
        embedding,
        options.topK ?? DEFAULT_TOP_K,
        options.minSimilarity ?? DEFAULT_MIN_SIMILARITY
    )

    if (chunks.length === 0) {
        return {
            answer:
                "I couldn't find anything relevant in your documents. Try rephrasing, or upload a document that covers this.",
            sources: [],
            chunks: [],
        }
    }

    // The question is supplied once, as the final user turn. It used to also be
    // interpolated into the system prompt, which showed the model two copies.
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: buildSystemPrompt(chunks) },
        ...sanitizeHistory(options.history),
        { role: 'user', content: question },
    ]

    const completion = await getOpenAI().chat.completions.create({
        model: options.model ?? ANSWER_MODEL,
        messages,
        temperature: 0.2,
    })

    const answer = completion.choices[0]?.message?.content
    if (!answer) {
        throw new AppError('The model returned an empty answer.', 502)
    }

    return {
        answer,
        sources: chunks.map(c => ({
            name: c.metadata.source_name,
            excerpt: c.content.slice(0, 150) + '...',
            similarity: c.similarity,
        })),
        chunks,
    }
}
