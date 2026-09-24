import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/lib/auth'
import { isAppError } from '@/lib/errors'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
    try {
        const userId = await requireUserId()

        const documents = await prisma.document.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                sourceType: true,
                createdAt: true,
            },
        })

        return NextResponse.json(documents)
    } catch (error) {
        if (isAppError(error)) {
            return NextResponse.json({ error: error.message }, { status: error.status })
        }
        console.error('Documents fetch error:', error)
        return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
    }
}
