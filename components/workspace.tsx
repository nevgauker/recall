'use client'

import { useEffect, useRef, useState } from 'react'
import { UserButton } from '@clerk/nextjs'
import { CheckCircle2, Library as LibraryIcon, X, XCircle } from 'lucide-react'
import { SAMPLE_DOCUMENT_NAME, SAMPLE_QUESTIONS } from '@/lib/sample-document'
import { LogoMark } from '@/components/brand'
import { Composer, MessageList, Welcome } from '@/components/chat'
import { Library } from '@/components/library'
import { ThemeToggle } from '@/components/theme-toggle'
import type { LibraryDocument, Message, SourceType } from '@/components/types'
import { MAX_PDF_LABEL } from '@/lib/limits'

type Toast = { kind: 'success' | 'error'; text: string }

/**
 * Read an API response's JSON, tolerating bodies that aren't JSON. Platform
 * errors (Vercel's 413 for an oversized upload, a gateway timeout) arrive as
 * plain text or HTML, and used to surface as a bare "Upload failed".
 *
 * Throws if the request was redirected: an expired session makes the
 * middleware send API calls to the sign-in page, which fetch follows and
 * reports as a 200. Treated as success, that showed "Added" for an upload that
 * never happened, and crashed the page when stored as the document list.
 */
async function readJson(res: Response): Promise<{ error?: string; [key: string]: unknown }> {
  if (res.redirected) {
    throw new Error('Your session has expired. Refresh the page to sign in again.')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok && !data.error) {
    if (res.status === 413) return { error: `That file is too large to upload. The limit is ${MAX_PDF_LABEL}.` }
    if (res.status === 504) return { error: 'The server took too long to respond. Try again, or try a smaller file.' }
  }
  return data
}

export function Workspace() {
  const [documents, setDocuments] = useState<LibraryDocument[]>([])
  const [documentsLoaded, setDocumentsLoaded] = useState(false)
  const [documentError, setDocumentError] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [asking, setAsking] = useState(false)
  // `asking` is the render-time value; two clicks in the same frame both see
  // false. The ref is updated synchronously and is the real guard.
  const askingRef = useRef(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [loadingSample, setLoadingSample] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)

  useEffect(() => {
    fetchDocuments()
  }, [])

  useEffect(() => {
    if (!libraryOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setLibraryOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [libraryOpen])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), toast.kind === 'error' ? 6000 : 3500)
    return () => clearTimeout(timer)
  }, [toast])

  async function fetchDocuments() {
    try {
      setDocumentError(null)
      const res = await fetch('/api/documents')
      const data = await readJson(res)
      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to fetch documents')
      }
      // Belt and braces: anything but an array would crash the first `.some()`.
      if (!Array.isArray(data)) {
        throw new Error('Failed to fetch documents')
      }
      setDocuments(data as LibraryDocument[])
    } catch (error) {
      console.error('Fetch documents error:', error)
      const message = error instanceof Error ? error.message : 'Failed to fetch documents'
      setDocumentError(message)
      setToast({ kind: 'error', text: message })
    } finally {
      setDocumentsLoaded(true)
    }
  }

  async function handleUpload(input: {
    type: SourceType
    name: string
    file: File | null
    text: string
    url: string
  }): Promise<boolean> {
    try {
      const formData = new FormData()
      formData.append('type', input.type)
      formData.append('name', input.name || 'Untitled')
      if (input.type === 'pdf' && input.file) formData.append('file', input.file)
      if (input.type === 'text') formData.append('content', input.text)
      if (input.type === 'url') formData.append('url', input.url)

      const res = await fetch('/api/ingest', { method: 'POST', body: formData })
      const data = await readJson(res)
      if (!res.ok) {
        throw new Error(data.error ?? 'Upload failed')
      }
      setToast({ kind: 'success', text: `Added “${input.name || 'Untitled'}”` })
      setLibraryOpen(false)
      await fetchDocuments()
      return true
    } catch (error) {
      console.error('Upload error:', error)
      setToast({ kind: 'error', text: error instanceof Error ? error.message : 'Upload failed' })
      return false
    }
  }

  async function handleLoadSample() {
    setLoadingSample(true)
    try {
      const res = await fetch('/api/sample', { method: 'POST' })
      const data = await readJson(res)
      if (!res.ok) {
        throw new Error(data.error ?? 'Could not load the sample document')
      }
      setToast({ kind: 'success', text: 'Sample handbook added. Pick a question to try.' })
      setLibraryOpen(false)
      await fetchDocuments()
    } catch (error) {
      console.error('Sample load error:', error)
      setToast({
        kind: 'error',
        text: error instanceof Error ? error.message : 'Could not load the sample document',
      })
    } finally {
      setLoadingSample(false)
    }
  }

  async function handleAsk(text: string) {
    if (!text.trim() || askingRef.current) return
    askingRef.current = true
    setAsking(true)

    // Failed questions were never answered; sending them as history would
    // show the model an unanswered question ahead of this one.
    const history = messages.filter(m => !m.error).map(m => ({ role: m.role, content: m.content }))
    setMessages(prev => [...prev, { role: 'user', content: text }])

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, history }),
      })
      const data = await readJson(res)
      if (!res.ok) {
        throw new Error(data.error ?? 'Query failed')
      }
      if (typeof data.answer !== 'string' || !data.answer) {
        throw new Error('No answer returned')
      }
      const answer = data.answer
      setMessages(prev => [...prev, { role: 'assistant', content: answer, sources: data.sources as Message['sources'] }])
    } catch (error) {
      console.error('Ask error:', error)
      const message = error instanceof Error ? error.message : 'Query failed'
      // Mark the question itself as failed: the user sees why, can retry it
      // without retyping, and it stays out of future history.
      setMessages(prev => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last?.role === 'user' && last.content === text) next[next.length - 1] = { ...last, error: message }
        return next
      })
    } finally {
      askingRef.current = false
      setAsking(false)
    }
  }

  function handleRetry(index: number) {
    const failed = messages[index]
    if (!failed?.error || askingRef.current) return
    setMessages(prev => prev.filter((_, i) => i !== index))
    handleAsk(failed.content)
  }

  async function handleDeleteDocument(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
      // Read even on success: readJson is what catches a session redirect.
      const payload = await readJson(res)
      if (!res.ok) {
        throw new Error(payload.error ?? 'Delete failed')
      }
      await fetchDocuments()
      setToast({ kind: 'success', text: 'Document deleted' })
    } catch (error) {
      console.error('Delete document error:', error)
      // A toast, not documentError: on mobile the library (where documentError
      // renders) is usually hidden behind the closed drawer.
      setToast({ kind: 'error', text: error instanceof Error ? error.message : 'Delete failed' })
    } finally {
      setDeletingId(null)
    }
  }

  const hasDocuments = documents.length > 0
  const suggestions = documents.some(d => d.name === SAMPLE_DOCUMENT_NAME) ? SAMPLE_QUESTIONS : []

  const library = (
    <Library
      documents={documents}
      documentsLoaded={documentsLoaded}
      documentError={documentError}
      deletingId={deletingId}
      loadingSample={loadingSample}
      onUpload={handleUpload}
      onDelete={handleDeleteDocument}
      onLoadSample={handleLoadSample}
    />
  )

  return (
    <div className="flex h-dvh flex-col bg-canvas text-ink">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
        <div className="flex items-center gap-2.5">
          <LogoMark />
          <span className="text-[15px] font-semibold tracking-tight">Recall</span>
          <span className="hidden text-sm text-muted sm:inline">· Ask your documents</span>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setLibraryOpen(true)}
            className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-muted transition hover:bg-subtle hover:text-ink md:hidden"
          >
            <LibraryIcon className="size-4.5" />
            {documents.length}
          </button>
          <ThemeToggle />
          <div className="ml-1 flex size-9 items-center justify-center">
            <UserButton />
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* One Library instance for every screen size. It used to be rendered
            twice, with the mobile copy mounted only while the drawer was open,
            so closing the drawer mid-upload discarded the upload's busy state
            and let the same file be submitted again. */}
        {libraryOpen && (
          <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={() => setLibraryOpen(false)} aria-hidden />
        )}
        <aside
          aria-label="Library"
          className={`fixed inset-y-0 left-0 z-50 flex w-[88%] max-w-sm flex-col bg-surface shadow-xl transition-transform duration-200 md:static md:z-auto md:w-80 md:max-w-none md:translate-x-0 md:border-r md:border-line md:shadow-none ${
            libraryOpen ? 'translate-x-0' : 'invisible -translate-x-full md:visible'
          }`}
        >
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4 md:hidden">
            <span className="text-sm font-semibold">Your library</span>
            <button
              onClick={() => setLibraryOpen(false)}
              aria-label="Close library"
              className="grid size-9 place-items-center rounded-lg text-muted hover:bg-subtle"
            >
              <X className="size-4.5" />
            </button>
          </div>
          <div className="min-h-0 flex-1">{library}</div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              documentsLoaded && (
                <Welcome
                  hasDocuments={hasDocuments}
                  documentCount={documents.length}
                  suggestions={suggestions}
                  loadingSample={loadingSample}
                  onLoadSample={handleLoadSample}
                  onOpenLibrary={() => setLibraryOpen(true)}
                  onAsk={handleAsk}
                />
              )
            ) : (
              <MessageList messages={messages} asking={asking} onRetry={handleRetry} />
            )}
          </div>

          <Composer
            disabled={asking}
            placeholder={hasDocuments ? 'Ask a question about your documents…' : 'Add a document first, then ask anything…'}
            onSend={handleAsk}
          />
        </main>
      </div>

      {toast && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-50 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-start gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm shadow-lg"
        >
          {toast.kind === 'success' ? (
            <CheckCircle2 className="mt-px size-4 shrink-0 text-emerald-500" />
          ) : (
            <XCircle className="mt-px size-4 shrink-0 text-red-500" />
          )}
          <span className="text-ink">{toast.text}</span>
          <button onClick={() => setToast(null)} aria-label="Dismiss" className="ml-1 text-muted hover:text-ink">
            <X className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}
