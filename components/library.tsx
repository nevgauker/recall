'use client'

import { useRef, useState } from 'react'
import {
  Check,
  FileText,
  Globe,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Type,
  UploadCloud,
  X,
} from 'lucide-react'
import type { LibraryDocument, SourceType } from './types'

const TYPE_META: Record<SourceType, { label: string; icon: typeof FileText }> = {
  pdf: { label: 'PDF', icon: FileText },
  text: { label: 'Text', icon: Type },
  url: { label: 'Web page', icon: Globe },
}

/** A sensible document name, so the user only types one when they want to. */
function defaultName(type: SourceType, file: File | null, text: string, url: string): string {
  if (type === 'pdf' && file) return file.name.replace(/\.pdf$/i, '')
  if (type === 'url' && url) {
    try {
      const u = new URL(url)
      const path = u.pathname.replace(/\/$/, '')
      return `${u.hostname.replace(/^www\./, '')}${path}`.slice(0, 120)
    } catch {
      return ''
    }
  }
  if (type === 'text' && text.trim()) {
    const words = text.trim().split(/\s+/).slice(0, 6).join(' ')
    return words.length < text.trim().length ? `${words}…` : words
  }
  return ''
}

function timeAgo(iso: string): string {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 7 * 86400) return `${Math.floor(seconds / 86400)}d ago`
  return new Date(iso).toLocaleDateString()
}

const inputClass =
  'w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/70 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20'

interface LibraryProps {
  documents: LibraryDocument[]
  documentsLoaded: boolean
  documentError: string | null
  deletingId: string | null
  loadingSample: boolean
  onUpload: (input: { type: SourceType; name: string; file: File | null; text: string; url: string }) => Promise<boolean>
  onDelete: (id: string) => void
  onLoadSample: () => void
}

export function Library(props: LibraryProps) {
  const { documents, documentsLoaded, documentError, deletingId, loadingSample } = props

  return (
    <div className="flex h-full flex-col">
      <AddSource onUpload={props.onUpload} />

      <div className="flex items-center justify-between px-5 pt-5 pb-2">
        <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Library</h2>
        <span className="rounded-full bg-subtle px-2 py-0.5 text-xs font-medium text-muted">
          {documents.length}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {documentError && (
          <p className="mx-2 mb-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
            {documentError}
          </p>
        )}

        {documentsLoaded && documents.length === 0 && (
          <div className="mx-2 rounded-xl border border-dashed border-line p-4 text-center">
            <p className="text-sm text-muted">No documents yet.</p>
            <button
              onClick={props.onLoadSample}
              disabled={loadingSample}
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent-hover disabled:opacity-60"
            >
              {loadingSample ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {loadingSample ? 'Adding sample…' : 'Add the sample handbook'}
            </button>
          </div>
        )}

        <ul className="space-y-1">
          {documents.map(doc => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              deleting={deletingId === doc.id}
              onDelete={() => props.onDelete(doc.id)}
            />
          ))}
        </ul>
      </div>
    </div>
  )
}

function DocumentRow({ doc, deleting, onDelete }: { doc: LibraryDocument; deleting: boolean; onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const meta = TYPE_META[doc.sourceType as SourceType] ?? TYPE_META.text
  const Icon = meta.icon

  return (
    <li className="group flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-subtle">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent-ink">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink" title={doc.name}>
          {doc.name}
        </p>
        <p className="text-xs text-muted">
          {meta.label} · {timeAgo(doc.createdAt)}
        </p>
      </div>

      {deleting ? (
        <Loader2 className="size-4 animate-spin text-muted" />
      ) : confirming ? (
        <div className="flex items-center gap-1">
          <button
            onClick={onDelete}
            aria-label={`Confirm delete ${doc.name}`}
            className="grid size-7 place-items-center rounded-md bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400"
          >
            <Check className="size-3.5" />
          </button>
          <button
            onClick={() => setConfirming(false)}
            aria-label="Cancel delete"
            className="grid size-7 place-items-center rounded-md text-muted hover:bg-line"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          aria-label={`Delete ${doc.name}`}
          className="grid size-7 place-items-center rounded-md text-muted opacity-100 transition hover:bg-line hover:text-red-600 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </li>
  )
}

function AddSource({ onUpload }: { onUpload: LibraryProps['onUpload'] }) {
  const [type, setType] = useState<SourceType>('pdf')
  const [file, setFile] = useState<File | null>(null)
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const suggested = defaultName(type, file, text, url)
  const ready = type === 'pdf' ? !!file : type === 'text' ? !!text.trim() : !!url.trim()

  function pickFile(f: File | undefined | null) {
    if (f && (f.type === 'application/pdf' || /\.pdf$/i.test(f.name))) setFile(f)
  }

  async function submit() {
    if (!ready || busy) return
    setBusy(true)
    const ok = await onUpload({ type, name: name.trim() || suggested, file, text, url })
    setBusy(false)
    if (ok) {
      setFile(null)
      setText('')
      setUrl('')
      setName('')
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <div className="border-b border-line p-5">
      <h2 className="mb-3 text-sm font-semibold text-ink">Add a source</h2>

      <div role="tablist" className="mb-3 grid grid-cols-3 gap-1 rounded-lg bg-subtle p-1">
        {(Object.keys(TYPE_META) as SourceType[]).map(t => {
          const Icon = TYPE_META[t].icon
          const active = type === t
          return (
            <button
              key={t}
              role="tab"
              aria-selected={active}
              onClick={() => setType(t)}
              className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                active ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'
              }`}
            >
              <Icon className="size-3.5" />
              {t === 'url' ? 'URL' : TYPE_META[t].label}
            </button>
          )
        })}
      </div>

      <div className="space-y-2.5">
        {type === 'pdf' && (
          <label
            onDragOver={e => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => {
              e.preventDefault()
              setDragging(false)
              pickFile(e.dataTransfer.files[0])
            }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-3 py-5 text-center transition ${
              dragging ? 'border-accent bg-accent-soft' : 'border-line hover:border-accent/60 hover:bg-subtle'
            }`}
          >
            <UploadCloud className={`size-5 ${file ? 'text-accent' : 'text-muted'}`} />
            {file ? (
              <span className="max-w-full truncate text-sm font-medium text-ink">{file.name}</span>
            ) : (
              <span className="text-sm text-ink">
                <span className="font-medium text-accent">Choose a PDF</span> or drop it here
              </span>
            )}
            <span className="text-xs text-muted">Up to 20 MB</span>
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,application/pdf"
              className="sr-only"
              onChange={e => pickFile(e.target.files?.[0])}
            />
          </label>
        )}

        {type === 'text' && (
          <textarea
            placeholder="Paste text…"
            value={text}
            onChange={e => setText(e.target.value)}
            rows={4}
            className={`${inputClass} resize-y`}
          />
        )}

        {type === 'url' && (
          <input
            type="url"
            placeholder="https://example.com/article"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            className={inputClass}
          />
        )}

        <input
          placeholder={suggested ? `Name: ${suggested}` : 'Name (optional)'}
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={200}
          className={inputClass}
          aria-label="Document name"
        />

        <button
          onClick={submit}
          disabled={!ready || busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-on-accent transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          {busy ? 'Reading and indexing…' : 'Add to library'}
        </button>
      </div>
    </div>
  )
}
