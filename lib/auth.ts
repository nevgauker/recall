import { auth } from '@clerk/nextjs/server'
import { AppError } from './errors'

/**
 * The Clerk user id for the current request.
 *
 * Every document read and write is scoped by this value, so a route that
 * forgets to call it fails closed rather than exposing another user's data.
 */
export async function requireUserId(): Promise<string> {
    const { userId } = await auth()
    if (!userId) {
        throw new AppError('You must be signed in.', 401)
    }
    return userId
}
