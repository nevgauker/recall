import type { ReactNode } from 'react'
import { FileSearch } from 'lucide-react'

const SIZES = {
  sm: { box: 'size-8 rounded-lg', icon: 'size-4' },
  lg: { box: 'size-11 rounded-xl', icon: 'size-5' },
}

/** The Recall mark. The one place to change the logo. */
export function LogoMark({ size = 'sm', className = '' }: { size?: keyof typeof SIZES; className?: string }) {
  const s = SIZES[size]
  return (
    <span className={`grid shrink-0 place-items-center bg-accent text-on-accent ${s.box} ${className}`}>
      <FileSearch className={s.icon} />
    </span>
  )
}

/** Shared frame for the sign-in and sign-up pages. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-canvas p-6">
      <div className="flex flex-col items-center text-center">
        <LogoMark size="lg" className="mb-4" />
        <h1 className="text-xl font-semibold tracking-tight text-ink">Recall</h1>
        <p className="mt-1 max-w-xs text-sm text-muted">
          Cited answers from your own documents. Try it with a sample in under a minute.
        </p>
      </div>
      {children}
    </main>
  )
}
