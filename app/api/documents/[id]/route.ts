import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/auth'
import { isAppError } from '@/lib/errors'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function DELETE(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const userId = await requireUserId()
        const { id } = await params

        // deleteMany, not delete: the userId predicate makes another user's id
        // a no-op rather than a successful delete. Chunks go with it via the
        // FK's ON DELETE CASCADE.
        const { count } = await prisma.document.deleteMany({
            where: { id, userId },
        })

        if (count === 0) {
            return NextResponse.json({ error: 'Document not found' }, { status: 404 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        if (isAppError(error)) {
            return NextResponse.json({ error: error.message }, { status: error.status })
        }
        console.error('Document delete error:', error)
        return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 })
    }
}
