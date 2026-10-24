import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/auth'
import { isAppError } from '@/lib/errors'
import { ingestDocument } from '@/lib/ingest'
import { enforceDocumentCap, enforceRateLimit } from '@/lib/rate-limit'
import { SAMPLE_DOCUMENT_CONTENT, SAMPLE_DOCUMENT_NAME } from '@/lib/sample-document'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Add the sample handbook to the caller's own library.
 *
 * Each user gets their own copy rather than a shared one, so retrieval stays a
 * single owner-scoped query with no special case. It goes through the same
 * cap and limits as any upload, and is idempotent: clicking twice doesn't
 * embed it twice.
 */
export async function POST() {
    try {
        const userId = await requireUserId()

        const existing = await prisma.document.findFirst({
            where: { userId, name: SAMPLE_DOCUMENT_NAME },
            select: { id: true },
        })
        if (existing) {
            return NextResponse.json({ success: true, documentId: existing.id, alreadyLoaded: true })
        }

        await enforceDocumentCap(userId)
        await enforceRateLimit(userId, 'ingest')

        const result = await ingestDocument(userId, SAMPLE_DOCUMENT_CONTENT, SAMPLE_DOCUMENT_NAME, 'text')
        return NextResponse.json({ success: true, ...result })
    } catch (error) {
        if (isAppError(error)) {
            return NextResponse.json({ error: error.message }, { status: error.status, headers: error.headers })
        }
        console.error('Sample load error:', error)
        return NextResponse.json({ error: 'Could not load the sample document' }, { status: 500 })
    }
}
