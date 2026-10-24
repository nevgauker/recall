export interface Source {
  name: string
  excerpt: string
  similarity?: number
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  /** Set on a user message whose question failed. It is shown with a retry
   *  button and never sent as conversation history. */
  error?: string
}

export interface LibraryDocument {
  id: string
  name: string
  sourceType: string
  createdAt: string
}

export type SourceType = 'pdf' | 'text' | 'url'
