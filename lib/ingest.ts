import { prisma } from './prisma'
import OpenAI from 'openai'

let openaiInstance: OpenAI | undefined

function getOpenAI(): OpenAI {
    if (!openaiInstance) {
        openaiInstance = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    }
    return openaiInstance
}

// --- Text splitter ---
function splitIntoChunks(text: string, chunkSize = 500, overlap = 50): string[] {
    const words = text.split(/\s+/)
    const chunks: string[] = []
    let i = 0

    while (i < words.length) {
        const chunk = words.slice(i, i + chunkSize).join(' ')
        chunks.push(chunk)
        i += chunkSize - overlap
    }

    return chunks
}

// --- Embed chunks ---
async function embedTexts(texts: string[]): Promise<number[][]> {
    const response = await getOpenAI().embeddings.create({
        model: 'text-embedding-3-small',
        input: texts,
    })
    return response.data.map(d => d.embedding)
}

// --- Main ingest function ---
export async function ingestDocument(
    content: string,
    sourceName: string,
    sourceType: 'pdf' | 'text' | 'url',
    sourceUrl?: string
) {
    // 1. Save document record
    const doc = await prisma.document.create({
        data: { name: sourceName, sourceType, sourceUrl },
    })

    // 2. Split into chunks
    const chunks = splitIntoChunks(content)

    // 3. Embed all chunks
    const embeddings = await embedTexts(chunks)

    // 4. Store chunks + embeddings via raw SQL (pgvector)
    for (let i = 0; i < chunks.length; i++) {
        await prisma.$executeRaw`
      INSERT INTO "DocumentChunk" (id, "documentId", content, embedding, metadata, "createdAt")
      VALUES (
        gen_random_uuid(),
        ${doc.id},
        ${chunks[i]},
        ${JSON.stringify(embeddings[i])}::vector,
        ${JSON.stringify({ chunk_index: i, source_name: sourceName, source_url: sourceUrl ?? null })}::jsonb,
        NOW()
      )
    `
    }

    return { documentId: doc.id, chunkCount: chunks.length }
}

// --- PDF extractor ---
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
    // Import the parser implementation directly to avoid pdf-parse's debug entrypoint.
    const pdfParseModule = await import('pdf-parse/lib/pdf-parse.js')
    const pdfParse = pdfParseModule.default as (input: Buffer) => Promise<{ text?: string }>
    const data = await pdfParse(buffer)
    return data.text ?? ''
}

// --- URL extractor ---
export async function extractTextFromUrl(url: string): Promise<string> {
    const res = await fetch(url)
    const html = await res.text()
    // Strip HTML tags
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}
