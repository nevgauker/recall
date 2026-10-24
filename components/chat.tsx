'use client'

import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  AlertCircle,
  ArrowUp,
  BookOpenText,
  Check,
  Copy,
  FileSearch,
  Loader2,
  MessageSquareText,
  Quote,
  RotateCcw,
  Sparkles,
  Upload,
} from 'lucide-react'
import { parseAnswer, parseCitationGroup } from './answer-format'
import type { Message, Source } from './types'

/* ----------------------------- Empty states ----------------------------- */

const STEPS = [
  { icon: Upload, title: 'Add a source', body: 'A PDF, pasted text, or a web page.' },
  { icon: MessageSquareText, title: 'Ask in plain language', body: 'Follow-up questions keep context.' },
  { icon: Quote, title: 'Check the sources', body: 'Every answer cites the passages it used.' },
]

export function Welcome({
  hasDocuments,
  documentCount,
  suggestions,
  loadingSample,
  onLoadSample,
  onOpenLibrary,
  onAsk,
}: {
  hasDocuments: boolean
  documentCount: number
  suggestions: string[]
  loadingSample: boolean
  onLoadSample: () => void
  onOpenLibrary: () => void
  onAsk: (q: string) => void
}) {
  if (!hasDocuments) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-12 text-center md:py-20">
        <span className="mb-5 grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent-ink">
          <FileSearch className="size-6" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-ink md:text-3xl">
          Answers from your own documents
        </h1>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted">
          Recall reads what you give it and answers only from that, with citations, and says so when the
          answer isn’t there.
        </p>

        <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row">
          <button
            onClick={onLoadSample}
            disabled={loadingSample}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-on-accent shadow-sm transition hover:bg-accent-hover disabled:opacity-60"
          >
            {loadingSample ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {loadingSample ? 'Adding sample…' : 'Try it with a sample handbook'}
          </button>
          <button
            onClick={onOpenLibrary}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-subtle md:hidden"
          >
            <Upload className="size-4" />
            Add your own
          </button>
          <span className="hidden text-sm text-muted md:inline">or add your own on the left</span>
        </div>

        <div className="mt-12 grid w-full gap-3 text-left sm:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <div key={title} className="rounded-xl border border-line bg-surface p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-md bg-subtle text-xs font-semibold text-muted">
                  {i + 1}
                </span>
                <Icon className="size-4 text-accent" />
              </div>
              <p className="text-sm font-medium text-ink">{title}</p>
              <p className="mt-0.5 text-[13px] text-muted">{body}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-12 text-center md:py-20">
      <span className="mb-5 grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent-ink">
        <BookOpenText className="size-6" />
      </span>
      <h1 className="text-2xl font-semibold tracking-tight text-ink">What would you like to know?</h1>
      <p className="mt-2 text-[15px] text-muted">
        Ask anything about your {documentCount === 1 ? 'document' : `${documentCount} documents`}.
      </p>

      {suggestions.length > 0 && (
        <div className="mt-8 grid w-full gap-2 sm:grid-cols-2">
          {suggestions.map(q => (
            <button
              key={q}
              onClick={() => onAsk(q)}
              className="rounded-xl border border-line bg-surface px-4 py-3 text-left text-sm text-ink transition hover:border-accent/50 hover:bg-accent-soft"
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------- Messages ------------------------------- */

/** **bold** and [n] citations inside one line of text. */
function renderInline(text: string, onCite: (n: number) => void, sourceCount: number): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\[\d+(?:,\s*\d+)*\])/g).map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return (
        <strong key={i} className="font-semibold text-ink">
          {part.slice(2, -2)}
        </strong>
      )
    }
    const cite = part.match(/^\[(\d+(?:,\s*\d+)*)\]$/)
    if (cite) {
      const numbers = parseCitationGroup(cite[1])
      return (
        <Fragment key={i}>
          {numbers.map(n =>
            n >= 1 && n <= sourceCount ? (
              <button
                key={n}
                onClick={() => onCite(n)}
                className="mx-0.5 inline-grid h-4.5 min-w-4.5 -translate-y-px place-items-center rounded bg-accent-soft px-1 align-middle text-[11px] font-semibold text-accent-ink transition hover:bg-accent hover:text-on-accent"
                aria-label={`Show source ${n}`}
              >
                {n}
              </button>
            ) : (
              <span key={n}>[{n}]</span>
            )
          )}
        </Fragment>
      )
    }
    return part
  })
}

/** Paragraphs and lists, with inline bold and citations. Parsing is in answer-format.ts. */
function AnswerText({ text, sourceCount, onCite }: { text: string; sourceCount: number; onCite: (n: number) => void }) {
  return (
    <div className="space-y-3">
      {parseAnswer(text).map((block, i) => {
        if (block.type === 'paragraph') {
          return <p key={i}>{renderInline(block.text, onCite, sourceCount)}</p>
        }
        const items = block.items.map((item, j) => <li key={j}>{renderInline(item, onCite, sourceCount)}</li>)
        return block.ordered ? (
          <ol key={i} start={block.start} className="list-decimal space-y-1 pl-5">
            {items}
          </ol>
        ) : (
          <ul key={i} className="list-disc space-y-1 pl-5">
            {items}
          </ul>
        )
      })}
    </div>
  )
}

function SourceCard({ source, index, active }: { source: Source; index: number; active: boolean }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [active])

  return (
    <div
      ref={ref}
      className={`rounded-lg border p-3 transition ${
        active ? 'border-accent bg-accent-soft' : 'border-line bg-surface'
      }`}
    >
      <div className="mb-1 flex items-center gap-2">
        <span className="grid h-4.5 min-w-4.5 place-items-center rounded bg-subtle px-1 text-[11px] font-semibold text-muted">
          {index + 1}
        </span>
        <span className="truncate text-xs font-medium text-ink">{source.name}</span>
        {typeof source.similarity === 'number' && (
          <span className="ml-auto shrink-0 text-[11px] text-muted" title="Semantic similarity to your question">
            {Math.round(source.similarity * 100)}% match
          </span>
        )}
      </div>
      <p className="line-clamp-3 text-xs leading-relaxed text-muted">{source.excerpt}</p>
    </div>
  )
}

function AssistantMessage({ message }: { message: Message }) {
  const [activeSource, setActiveSource] = useState<number | null>(null)
  const [showSources, setShowSources] = useState(false)
  const [copied, setCopied] = useState(false)
  const sources = message.sources ?? []

  function cite(n: number) {
    setShowSources(true)
    setActiveSource(n - 1)
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard can be blocked; nothing useful to do.
    }
  }

  return (
    <div className="flex gap-3">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-accent text-on-accent">
        <Sparkles className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] leading-relaxed text-ink">
          <AnswerText text={message.content} sourceCount={sources.length} onCite={cite} />
        </div>

        <div className="mt-3 flex items-center gap-1">
          {sources.length > 0 && (
            <button
              onClick={() => setShowSources(s => !s)}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted transition hover:bg-subtle hover:text-ink"
            >
              <Quote className="size-3.5" />
              {showSources ? 'Hide sources' : `${sources.length} source${sources.length === 1 ? '' : 's'}`}
            </button>
          )}
          <button
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted transition hover:bg-subtle hover:text-ink"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        {showSources && sources.length > 0 && (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {sources.map((s, i) => (
              <SourceCard key={i} source={s} index={i} active={activeSource === i} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function MessageList({
  messages,
  asking,
  autoScroll = true,
  onRetry,
}: {
  messages: Message[]
  asking: boolean
  /** Off for static previews, where scrolling would move the host page. */
  autoScroll?: boolean
  /** Re-ask a failed question, identified by its index in `messages`. */
  onRetry?: (index: number) => void
}) {
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (autoScroll) end.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, asking, autoScroll])

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8 md:px-6">
      {messages.map((m, i) =>
        m.role === 'user' ? (
          <div key={i} className="flex flex-col items-end gap-1.5">
            <div
              className={`max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap ${
                m.error ? 'border border-red-500/40 bg-surface text-ink' : 'bg-accent text-on-accent'
              }`}
            >
              {m.content}
            </div>
            {m.error && (
              <div className="flex max-w-[85%] items-center gap-2 text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="size-3.5 shrink-0" />
                <span>{m.error}</span>
                {onRetry && (
                  <button
                    onClick={() => onRetry(i)}
                    disabled={asking}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-ink hover:bg-subtle disabled:opacity-50"
                  >
                    <RotateCcw className="size-3" />
                    Retry
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <AssistantMessage key={i} message={m} />
        )
      )}

      {asking && (
        <div className="flex items-center gap-3" aria-live="polite">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent text-on-accent">
            <Sparkles className="size-3.5" />
          </span>
          <div className="flex items-center gap-2 text-sm text-muted">
            <span className="flex gap-1">
              <span className="typing-dot size-1.5 rounded-full bg-muted" />
              <span className="typing-dot size-1.5 rounded-full bg-muted" />
              <span className="typing-dot size-1.5 rounded-full bg-muted" />
            </span>
            Searching your documents
          </div>
        </div>
      )}
      <div ref={end} />
    </div>
  )
}

/* ------------------------------- Composer ------------------------------- */

export function Composer({
  disabled,
  placeholder,
  onSend,
}: {
  disabled: boolean
  placeholder: string
  onSend: (text: string) => void
}) {
  const [value, setValue] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  // Grow with the content up to a cap, then scroll.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [value])

  function send() {
    const text = value.trim()
    if (!text || disabled) return
    onSend(text)
    setValue('')
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-4 md:px-6 md:pb-6">
      <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface p-2 shadow-sm transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              send()
            }
          }}
          placeholder={placeholder}
          maxLength={2000}
          className="max-h-50 flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] text-ink placeholder:text-muted/70 outline-none"
          aria-label="Your question"
        />
        <button
          onClick={send}
          disabled={disabled || !value.trim()}
          aria-label="Send"
          className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-on-accent transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          {disabled ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
        </button>
      </div>
      <p className="mt-2 text-center text-xs text-muted">
        Answers come only from your documents. Check the cited sources for anything important.
      </p>
    </div>
  )
}
