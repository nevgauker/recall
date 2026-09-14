import { NextRequest, NextResponse } from 'next/server'
import { requireUserId } from '@/lib/auth'
import { AppError, isAppError } from '@/lib/errors'
import { answerQuestion } from '@/lib/rag'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
    try {
        const userId = await requireUserId()

        const body = await req.json().catch(() => {
            throw new AppError('Malformed request body.')
        })

        const { answer, sources } = await answerQuestion({
            userId,
            question: typeof body?.question === 'string' ? body.question : '',
            history: body?.history,
        })

        return NextResponse.json({ answer, sources })
    } catch (error) {
        if (isAppError(error)) {
            return NextResponse.json({ error: error.message }, { status: error.status })
        }
        console.error('Query error:', error)
        return NextResponse.json({ error: 'Query failed' }, { status: 500 })
    }
}
