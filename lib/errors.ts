/**
 * An error whose message is safe to show the user, carrying the HTTP status
 * the route should answer with.
 *
 * Routes previously collapsed every failure into a generic 500, so the UI's
 * error states had nothing useful to render. Throw AppError for anything the
 * caller can act on; anything else stays a generic 500.
 */
export class AppError extends Error {
    readonly status: number

    constructor(message: string, status = 400) {
        super(message)
        this.name = 'AppError'
        this.status = status
    }
}

export function isAppError(error: unknown): error is AppError {
    return error instanceof AppError
}
