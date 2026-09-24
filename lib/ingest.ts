import { Prisma } from '@prisma/client'
import OpenAI from 'openai'
import { prisma } from './prisma'
import { AppError } from './errors'
import { safeFetchText } from './safe-fetch'

export const EMBEDDING_MODEL = 'text-embedding-3-small'
export const EMBEDDING_DIMENSIONS = 1536

/** Upload / fetch ceilings. Kept here so the route and the UI agree. */
export const MAX_PDF_BYTES = 20 * 1024 * 1024
export const MAX_TEXT_CHARS = 1_000_000
export const MAX_URL_BYTES = 5 * 1024 * 1024

/** Chunking. `CHUNK_OVERLAP` must stay below `CHUNK_SIZE` or the walk stalls. */
const CHUNK_SIZE = 500
const CHUNK_OVERLAP = 50
const MAX_CHUNK_CHARS = 8_000
const MAX_CHUNKS_PER_DOCUMENT = 2_000

/** Batch sizes: OpenAI caps inputs per embeddings request, Postgres caps bind
 *  parameters per statement (65535, and each chunk row uses four). */
const EMBED_BATCH_SIZE = 96
const INSERT_BATCH_SIZE = 200

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

// --- Text splitter ---
export function splitIntoChunks(
    text: string,
    chunkSize = CHUNK_SIZE,
    overlap = CHUNK_OVERLAP
): string[] {
    const stride = Math.max(1, chunkSize - overlap)
    const words = text.split(/\s+/).filter(Boolean)
    const chunks: string[] = []

    for (let i = 0; i < words.length; i += stride) {
        // A PDF with no whitespace can yield one enormous "word"; clamp so a
        // single chunk can never exceed the model's per-input limit.
        const chunk = words.slice(i, i + chunkSize).join(' ').slice(0, MAX_CHUNK_CHARS)
        if (chunk.trim()) chunks.push(chunk)
    }

    return chunks
}

// --- Embed chunks ---
/**
 * Embed every chunk, in batches.
 *
 * A single request per document breaks on anything large: the embeddings API
 * caps both inputs and total tokens per call, so a long PDF used to fail
 * outright.
 */
async function embedTexts(texts: string[]): Promise<number[][]> {
    const openai = getOpenAI()
    const embeddings: number[][] = []

    for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
        const batch = texts.slice(i, i + EMBED_BATCH_SIZE)
        const response = await openai.embeddings.create({
            model: EMBEDDING_MODEL,
            input: batch,
        })
        // The API may return items out of order; index is authoritative.
        const ordered = [...response.data].sort((a, b) => a.index - b.index)
        embeddings.push(...ordered.map(d => d.embedding))
    }

    if (embeddings.length !== texts.length) {
        throw new AppError('The embedding service returned an unexpected result.', 502)
    }

    return embeddings
}

// --- Main ingest function ---
export async function ingestDocument(
    userId: string,
    content: string,
    sourceName: string,
    sourceType: 'pdf' | 'text' | 'url',
    sourceUrl?: string
) {
    const chunks = splitIntoChunks(content)

    if (chunks.length === 0) {
        throw new AppError('No readable text was found in that source.')
    }
    if (chunks.length > MAX_CHUNKS_PER_DOCUMENT) {
        throw new AppError(
            `That document is too large (${chunks.length} chunks, limit ${MAX_CHUNKS_PER_DOCUMENT}). Split it and try again.`,
            413
        )
    }

    // Embed before writing anything. Embedding is the slow, failure-prone step;
    // doing it first means a failure leaves no half-written document behind.
    const embeddings = await embedTexts(chunks)

    // Document row and every chunk land together or not at all.
    const documentId = await prisma.$transaction(
        async tx => {
            const doc = await tx.document.create({
                data: { userId, name: sourceName, sourceType, sourceUrl },
            })

            for (let i = 0; i < chunks.length; i += INSERT_BATCH_SIZE) {
                const rows = chunks.slice(i, i + INSERT_BATCH_SIZE).map((chunk, j) => {
                    const index = i + j
                    const metadata = {
                        chunk_index: index,
                        source_name: sourceName,
                        source_url: sourceUrl ?? null,
                    }
                    return Prisma.sql`(
                        gen_random_uuid(),
                        ${doc.id},
                        ${chunk},
                        ${JSON.stringify(embeddings[index])}::vector,
                        ${JSON.stringify(metadata)}::jsonb,
                        NOW()
                    )`
                })

                await tx.$executeRaw`
                    INSERT INTO "DocumentChunk" (id, "documentId", content, embedding, metadata, "createdAt")
                    VALUES ${Prisma.join(rows, ',')}
                `
            }

            return doc.id
        },
        { timeout: 30_000, maxWait: 10_000 }
    )

    return { documentId, chunkCount: chunks.length }
}

// --- PDF extractor ---
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
    // Import the parser implementation directly to avoid pdf-parse's debug entrypoint.
    const pdfParseModule = await import('pdf-parse/lib/pdf-parse.js')
    const pdfParse = pdfParseModule.default as (input: Buffer) => Promise<{ text?: string }>
    try {
        const data = await pdfParse(buffer)
        return data.text ?? ''
    } catch {
        throw new AppError('That PDF could not be read. It may be corrupt or password protected.')
    }
}

// --- URL extractor ---
export async function extractTextFromUrl(url: string): Promise<string> {
    const html = await safeFetchText(url, MAX_URL_BYTES)

    // Drop script and style bodies before stripping tags, otherwise their
    // contents survive as "text" and get embedded as if they were prose.
    return html
        .replace(/<(script|style|noscript|template)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/\s+/g, ' ')
        .trim()
}
