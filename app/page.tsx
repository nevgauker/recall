'use client'

import { useEffect, useRef, useState } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  sources?: { name: string; excerpt: string }[]
}

interface Document {
  id: string
  name: string
  sourceType: string
  createdAt: string
}

export default function Home() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [question, setQuestion] = useState('')
  const [isDark, setIsDark] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)
  const [uploadType, setUploadType] = useState<'pdf' | 'text' | 'url'>('pdf')
  const [textContent, setTextContent] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [docName, setDocName] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const theme = isDark
    ? {
        main: 'bg-[#0a0a0a] text-[#e8e3d9]',
        aside: 'bg-[#0d0d0d] border-r border-[#1e1e1e]',
        panelBorder: 'border-[#1e1e1e]',
        tabInactive: 'text-[#444] border-[#222] bg-transparent',
        textSoft: 'text-[#666]',
        textMuted: 'text-[#444]',
        textNoData: 'text-[#333]',
        input: 'bg-[#0f0f0f] border-[#1e1e1e] text-[#e8e3d9]',
        button: 'bg-[#e8e3d9] text-[#0a0a0a] border-[#e8e3d9]',
        userBubble: 'bg-[#141414] border-[#1e1e1e]',
        assistantBubble: 'bg-[#0f0f0f] border-[#161616]',
        sourceChip: 'bg-[#0d0d0d] border-[#1a1a1a] text-[#555]',
      }
    : {
        main: 'bg-[#f6f3ec] text-[#1f1b16]',
        aside: 'bg-[#f0ebe2] border-r border-[#d8d0c4]',
        panelBorder: 'border-[#d8d0c4]',
        tabInactive: 'text-[#7a6e60] border-[#cdbfae] bg-transparent',
        textSoft: 'text-[#6b5f52]',
        textMuted: 'text-[#7a6e60]',
        textNoData: 'text-[#8f8170]',
        input: 'bg-[#fffaf2] border-[#d8d0c4] text-[#1f1b16]',
        button: 'bg-[#1f1b16] text-[#f6f3ec] border-[#1f1b16]',
        userBubble: 'bg-[#f4ebdd] border-[#d8d0c4]',
        assistantBubble: 'bg-[#fffaf2] border-[#d8d0c4]',
        sourceChip: 'bg-[#efe5d8] border-[#d8d0c4] text-[#7a6e60]',
      }

  useEffect(() => {
    fetchDocuments()
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function fetchDocuments() {
    const res = await fetch('/api/documents')
    const data = await res.json()
    setDocuments(data)
  }

  async function handleUpload() {
    if (!docName) return alert('Please enter a document name')
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('type', uploadType)
      formData.append('name', docName)

      if (uploadType === 'pdf') {
        const file = fileInputRef.current?.files?.[0]
        if (!file) return alert('Please select a PDF')
        formData.append('file', file)
      } else if (uploadType === 'text') {
        if (!textContent) return alert('Please enter text content')
        formData.append('content', textContent)
      } else if (uploadType === 'url') {
        if (!urlInput) return alert('Please enter a URL')
        formData.append('url', urlInput)
      }

      const res = await fetch('/api/ingest', { method: 'POST', body: formData })
      const data = await res.json()

      if (data.success) {
        setDocName('')
        setTextContent('')
        setUrlInput('')
        if (fileInputRef.current) fileInputRef.current.value = ''
        fetchDocuments()
      }
    } finally {
      setUploading(false)
    }
  }

  async function handleAsk() {
    if (!question.trim()) return

    const userMessage: Message = { role: 'user', content: question }
    setMessages(prev => [...prev, userMessage])
    setQuestion('')
    setAsking(true)

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history }),
      })
      const data = await res.json()

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer,
          sources: data.sources,
        },
      ])
    } finally {
      setAsking(false)
    }
  }

  async function handleDeleteDocument(id: string) {
    setDeletingDocumentId(id)
    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload.error ?? 'Delete failed')
      }
      await fetchDocuments()
    } catch (error) {
      console.error('Delete document error:', error)
      alert('Failed to delete document')
    } finally {
      setDeletingDocumentId(null)
    }
  }

  return (
    <main className={`min-h-screen grid grid-cols-[320px_1fr] font-serif ${theme.main}`}>
      <aside className={`p-8 px-6 flex flex-col gap-8 ${theme.aside}`}>
        <div>
          <p className={`mb-2 text-[0.65rem] tracking-[0.2em] ${theme.textSoft}`}>KNOWLEDGE BASE</p>
          <h1 className="m-0 text-[1.8rem] font-normal tracking-[-0.02em]">Recall</h1>
        </div>

        <div className="flex gap-2">
          {(['pdf', 'text', 'url'] as const).map(t => (
            <button
              key={t}
              onClick={() => setUploadType(t)}
              className={`flex-1 cursor-pointer border px-2 py-1.5 text-[0.7rem] uppercase tracking-[0.1em] transition-all duration-150 ${
                uploadType === t ? theme.button : theme.tabInactive
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          <input
            placeholder="Document name"
            value={docName}
            onChange={e => setDocName(e.target.value)}
            className={`w-full box-border rounded-[2px] border px-3.5 py-2.5 text-[0.82rem] outline-none ${theme.input}`}
          />
          {uploadType === 'pdf' && (
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              className={`w-full box-border rounded-[2px] border px-3.5 py-2.5 text-[0.82rem] outline-none ${theme.input}`}
            />
          )}
          {uploadType === 'text' && (
            <textarea
              placeholder="Paste your text here..."
              value={textContent}
              onChange={e => setTextContent(e.target.value)}
              rows={5}
              className={`w-full box-border resize-y rounded-[2px] border px-3.5 py-2.5 text-[0.82rem] outline-none ${theme.input}`}
            />
          )}
          {uploadType === 'url' && (
            <input
              placeholder="https://..."
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              className={`w-full box-border rounded-[2px] border px-3.5 py-2.5 text-[0.82rem] outline-none ${theme.input}`}
            />
          )}

          <button
            onClick={handleUpload}
            disabled={uploading}
            className={`cursor-pointer rounded-[2px] border px-4 py-2.5 text-[0.75rem] uppercase tracking-[0.1em] disabled:cursor-not-allowed disabled:opacity-70 ${theme.button}`}
          >
            {uploading ? 'Processing...' : '+ Add Document'}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <p className={`mb-4 text-[0.65rem] tracking-[0.15em] ${theme.textMuted}`}>UPLOADED ({documents.length})</p>
          {documents.length === 0 && <p className={`text-[0.8rem] italic ${theme.textNoData}`}>No documents yet</p>}

          {documents.map(doc => (
            <div key={doc.id} className={`mb-2 rounded-[2px] border p-3 ${theme.panelBorder}`}>
              <p className="m-0 text-[0.85rem]">{doc.name}</p>
              <div className="mt-1 flex items-center justify-between gap-3">
                <p className={`text-[0.65rem] tracking-[0.1em] ${theme.textMuted}`}>{doc.sourceType.toUpperCase()}</p>
                <button
                  onClick={() => handleDeleteDocument(doc.id)}
                  disabled={deletingDocumentId === doc.id}
                  className="cursor-pointer rounded-[2px] border border-red-500/50 px-2 py-1 text-[0.6rem] uppercase tracking-[0.08em] text-red-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {deletingDocumentId === doc.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <section className="relative flex h-screen flex-col">
        <button
          onClick={() => setIsDark(prev => !prev)}
          className={`absolute top-4 right-4 z-10 cursor-pointer rounded-[2px] border px-3 py-2 text-[0.68rem] uppercase tracking-[0.09em] ${theme.button}`}
        >
          {isDark ? 'Light Mode' : 'Dark Mode'}
        </button>

        <div className="flex flex-1 flex-col gap-8 overflow-y-auto px-16 py-12">
          {messages.length === 0 && (
            <div className={`m-auto text-center ${theme.textNoData}`}>
              <p className="mb-4 text-5xl">o</p>
              <p className="text-base tracking-[0.05em]">Ask anything from your documents</p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`max-w-[720px] ${msg.role === 'user' ? 'self-end' : 'self-start'}`}>
              <p
                className={`mb-1.5 text-[0.65rem] tracking-[0.15em] ${theme.textMuted} ${
                  msg.role === 'user' ? 'text-right' : 'text-left'
                }`}
              >
                {msg.role === 'user' ? 'YOU' : 'RECALL'}
              </p>
              <div
                className={`whitespace-pre-wrap rounded-[2px] border px-6 py-5 text-[0.92rem] leading-[1.7] ${
                  msg.role === 'user' ? theme.userBubble : theme.assistantBubble
                }`}
              >
                {msg.content}
              </div>

              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {msg.sources.map((s, j) => (
                    <div key={j} className={`rounded-[2px] border px-3 py-1.5 text-[0.7rem] tracking-[0.05em] ${theme.sourceChip}`}>
                      [{j + 1}] {s.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {asking && <div className={`self-start text-[0.85rem] italic ${theme.textNoData}`}>Searching documents...</div>}
          <div ref={chatEndRef} />
        </div>

        <div className={`flex gap-4 border-t px-16 pt-6 pb-8 ${theme.panelBorder}`}>
          <input
            placeholder="Ask a question about your documents..."
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAsk()}
            className={`w-full flex-1 box-border rounded-[2px] border px-5 py-3.5 text-[0.95rem] outline-none ${theme.input}`}
          />
          <button
            onClick={handleAsk}
            disabled={asking}
            className={`cursor-pointer rounded-[2px] border px-7 py-3.5 text-[0.8rem] uppercase tracking-[0.1em] disabled:cursor-not-allowed disabled:opacity-70 ${theme.button}`}
          >
            {asking ? '...' : 'Ask ->'}
          </button>
        </div>
      </section>
    </main>
  )
}
