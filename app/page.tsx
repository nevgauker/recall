'use client'

import { useEffect, useState } from 'react'
import { UserButton } from '@clerk/nextjs'
import { CheckCircle2, FileSearch, Library as LibraryIcon, X, XCircle } from 'lucide-react'
import { SAMPLE_DOCUMENT_NAME, SAMPLE_QUESTIONS } from '@/lib/sample-document'
import { Composer, MessageList, Welcome } from '@/components/chat'
import { Library } from '@/components/library'
import { ThemeToggle } from '@/components/theme-toggle'
import type { LibraryDocument, Message, SourceType } from '@/components/types'

type Toast = { kind: 'success' | 'error'; text: string }

export default function Home() {
  const [documents, setDocuments] = useState<LibraryDocument[]>([])
  const [documentsLoaded, setDocumentsLoaded] = useState(false)
  const [documentError, setDocumentError] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [asking, setAsking] = useState(false)
  const [queryError, setQueryError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [loadingSample, setLoadingSample] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)

  useEffect(() => {
    fetchDocuments()
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), toast.kind === 'error' ? 6000 : 3500)
    return () => clearTimeout(timer)
  }, [toast])

  async function fetchDocuments() {
    try {
      setDocumentError(null)
      const res = await fetch('/api/documents')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error ?? 'Failed to fetch documents')
      }
      setDocuments(data)
    } catch (error) {
      console.error('Fetch documents error:', error)
      setDocumentError(error instanceof Error ? error.message : 'Failed to fetch documents')
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
      const data = await res.json().catch(() => ({}))
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
      const data = await res.json().catch(() => ({}))
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
    if (!text.trim() || asking) return
    setQueryError(null)

    const history = messages.map(m => ({ role: m.role, content: m.content }))
    setMessages(prev => [...prev, { role: 'user', content: text }])
    setAsking(true)

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, history }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error ?? 'Query failed')
      }
      if (!data.answer) {
        throw new Error('No answer returned')
      }
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer, sources: data.sources }])
    } catch (error) {
      console.error('Ask error:', error)
      setQueryError(error instanceof Error ? error.message : 'Query failed')
    } finally {
      setAsking(false)
    }
  }

  async function handleDeleteDocument(id: string) {
    setDocumentError(null)
    setDeletingId(id)
    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload.error ?? 'Delete failed')
      }
      await fetchDocuments()
      setToast({ kind: 'success', text: 'Document deleted' })
    } catch (error) {
      console.error('Delete document error:', error)
      setDocumentError(error instanceof Error ? error.message : 'Delete failed')
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
          <span className="grid size-8 place-items-center rounded-lg bg-accent text-on-accent">
            <FileSearch className="size-4" />
          </span>
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
        <aside className="hidden w-80 shrink-0 border-r border-line bg-surface md:block">{library}</aside>

        {libraryOpen && (
          <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Library">
            <div className="absolute inset-0 bg-black/40" onClick={() => setLibraryOpen(false)} />
            <div className="absolute inset-y-0 left-0 flex w-[88%] max-w-sm flex-col bg-surface shadow-xl">
              <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
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
            </div>
          </div>
        )}

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
              <MessageList messages={messages} asking={asking} />
            )}
          </div>

          <Composer
            disabled={asking}
            error={queryError}
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
