import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
    try {
        const documents = await prisma.document.findMany({
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
        console.error('Documents fetch error:', error)
        return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
    }
}
