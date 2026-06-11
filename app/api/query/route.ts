import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

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

interface Chunk {
    id: string
    content: string
    metadata: { source_name: string; source_url?: string; chunk_index: number }
    document_id: string
    similarity: number
}

// --- Embed the user question ---
async function embedQuery(text: string): Promise<number[]> {
    const response = await getOpenAI().embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
    })
    return response.data[0].embedding
}

// --- Find most relevant chunks ---
async function similaritySearch(embedding: number[], limit = 5): Promise<Chunk[]> {
    const results = await prisma.$queryRaw<Chunk[]>`
    SELECT 
      id, 
      content, 
      metadata,
      "documentId" as document_id,
      1 - (embedding <=> ${JSON.stringify(embedding)}::vector) as similarity
    FROM "DocumentChunk"
    ORDER BY embedding <=> ${JSON.stringify(embedding)}::vector
    LIMIT ${limit}
  `
    return results
}

// --- Build prompt ---
function buildPrompt(question: string, chunks: Chunk[]) {
    const context = chunks
        .map((c: Chunk, i: number) =>
            `[${i + 1}] (Source: ${c.metadata.source_name})\n${c.content}`
        )
        .join('\n\n')

    return `You are a helpful knowledge assistant. Answer the question based only on the provided context. 
If the answer is not in the context, say "I couldn't find this in the uploaded documents."
Always cite which source number(s) you used, e.g. [1], [2].

Context:
${context}

Question: ${question}

Answer:`
}

export async function POST(req: NextRequest) {
    try {
        const { question, history } = await req.json()

        if (!question) {
            return NextResponse.json({ error: 'No question provided' }, { status: 400 })
        }

        // 1. Embed the question
        const embedding = await embedQuery(question)

        // 2. Find relevant chunks
        const chunks = await similaritySearch(embedding)

        if (chunks.length === 0) {
            return NextResponse.json({
                answer: "I couldn't find any relevant documents. Please upload some first.",
                sources: [],
            })
        }

        // 3. Build messages with conversation history
        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
            { role: 'system', content: buildPrompt(question, chunks) },
            ...(history || []),
            { role: 'user', content: question },
        ]

        // 4. Get answer from GPT-4o
        const completion = await getOpenAI().chat.completions.create({
            model: 'gpt-4o',
            messages,
            temperature: 0.2,
        })

        const answer = completion.choices[0].message.content

        // 5. Return answer + sources
        const sources = chunks.map((c: Chunk) => ({
            name: c.metadata.source_name,
            excerpt: c.content.slice(0, 150) + '...',
        }))

        return NextResponse.json({ answer, sources })

    } catch (error) {
        console.error('Query error:', error)
        return NextResponse.json({ error: 'Query failed' }, { status: 500 })
    }
}