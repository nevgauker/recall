/**
 * Upload limits shared by the server routes and the browser.
 *
 * No imports, so client components can use these without pulling server code
 * (Prisma, OpenAI) into the bundle.
 */

/**
 * PDFs are posted to /api/ingest as multipart form data, so the request body
 * is the whole file. Vercel rejects function request bodies above 4.5 MB
 * before the handler runs (FUNCTION_PAYLOAD_TOO_LARGE), so a larger limit
 * here would be a promise the deployment can't keep. Raising it needs uploads
 * that bypass the function, e.g. direct-to-storage.
 */
export const MAX_PDF_BYTES = 4 * 1024 * 1024
export const MAX_PDF_LABEL = '4 MB'

export const MAX_TEXT_CHARS = 1_000_000
export const MAX_URL_BYTES = 5 * 1024 * 1024

/** Mirrors the check in /api/ingest. */
export const MAX_DOCUMENT_NAME_CHARS = 200
