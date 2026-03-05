import { NextRequest, NextResponse } from 'next/server'
import { ingestDocument, extractTextFromPdf, extractTextFromUrl } from '@/lib/ingest'

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData()
        const type = formData.get('type') as 'pdf' | 'text' | 'url'
        const name = formData.get('name') as string

        let content = ''
        let sourceUrl: string | undefined

        if (type === 'pdf') {
            const file = formData.get('file') as File
            const buffer = Buffer.from(await file.arrayBuffer())
            content = await extractTextFromPdf(buffer)
        } else if (type === 'text') {
            content = formData.get('content') as string
        } else if (type === 'url') {
            sourceUrl = formData.get('url') as string
            content = await extractTextFromUrl(sourceUrl)
        }

        if (!content) {
            return NextResponse.json({ error: 'No content found' }, { status: 400 })
        }

        const result = await ingestDocument(content, name, type, sourceUrl)

        return NextResponse.json({ success: true, ...result })

    } catch (error) {
        console.error('Ingest error:', error)
        return NextResponse.json({ error: 'Ingestion failed' }, { status: 500 })
    }
}