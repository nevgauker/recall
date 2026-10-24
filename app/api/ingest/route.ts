import { NextRequest, NextResponse } from 'next/server'
import { requireUserId } from '@/lib/auth'
import { AppError, isAppError } from '@/lib/errors'
import {
    MAX_PDF_BYTES,
    MAX_TEXT_CHARS,
    extractTextFromPdf,
    extractTextFromUrl,
    ingestDocument,
} from '@/lib/ingest'
import { MAX_DOCUMENT_NAME_CHARS } from '@/lib/limits'
import { enforceDocumentCap, enforceRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
// PDF parsing plus batched embedding of a large document can take a while;
// serverless hosts default to as little as 10s.
export const maxDuration = 60

const SOURCE_TYPES = ['pdf', 'text', 'url'] as const
type SourceType = (typeof SOURCE_TYPES)[number]

function requireString(value: FormDataEntryValue | null, label: string): string {
    if (typeof value !== 'string' || !value.trim()) {
        throw new AppError(`${label} is required.`)
    }
    return value.trim()
}

export async function POST(req: NextRequest) {
    try {
        const userId = await requireUserId()
        await enforceDocumentCap(userId)
        await enforceRateLimit(userId, 'ingest')

        const formData = await req.formData().catch(() => {
            throw new AppError('Malformed upload.')
        })

        const type = formData.get('type')
        if (typeof type !== 'string' || !SOURCE_TYPES.includes(type as SourceType)) {
            throw new AppError(`type must be one of: ${SOURCE_TYPES.join(', ')}.`)
        }
        const sourceType = type as SourceType

        const name = requireString(formData.get('name'), 'Document name')
        if (name.length > MAX_DOCUMENT_NAME_CHARS) {
            throw new AppError(`Document name must be ${MAX_DOCUMENT_NAME_CHARS} characters or fewer.`)
        }

        let content = ''
        let sourceUrl: string | undefined

        if (sourceType === 'pdf') {
            const file = formData.get('file')
            // `as File` used to be a lie here: a missing field is null and
            // calling arrayBuffer() on it threw an opaque 500.
            if (!(file instanceof File) || file.size === 0) {
                throw new AppError('Please attach a PDF file.')
            }
            if (file.size > MAX_PDF_BYTES) {
                throw new AppError(
                    `That PDF is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is ${MAX_PDF_BYTES / 1024 / 1024} MB.`,
                    413
                )
            }
            content = await extractTextFromPdf(Buffer.from(await file.arrayBuffer()))
        } else if (sourceType === 'text') {
            content = requireString(formData.get('content'), 'Text content')
            if (content.length > MAX_TEXT_CHARS) {
                throw new AppError(
                    `That text is ${content.length} characters; the limit is ${MAX_TEXT_CHARS}.`,
                    413
                )
            }
        } else {
            sourceUrl = requireString(formData.get('url'), 'URL')
            content = await extractTextFromUrl(sourceUrl)
        }

        if (!content.trim()) {
            throw new AppError('No readable text was found in that source.')
        }

        const result = await ingestDocument(userId, content, name, sourceType, sourceUrl)

        return NextResponse.json({ success: true, ...result })
    } catch (error) {
        if (isAppError(error)) {
            return NextResponse.json({ error: error.message }, { status: error.status, headers: error.headers })
        }
        console.error('Ingest error:', error)
        return NextResponse.json({ error: 'Ingestion failed' }, { status: 500 })
    }
}
