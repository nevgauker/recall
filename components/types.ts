export interface Source {
  name: string
  excerpt: string
  similarity?: number
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
}

export interface LibraryDocument {
  id: string
  name: string
  sourceType: string
  createdAt: string
}

export type SourceType = 'pdf' | 'text' | 'url'
