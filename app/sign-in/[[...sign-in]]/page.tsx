import { SignIn } from '@clerk/nextjs'
import { FileSearch } from 'lucide-react'

export default function SignInPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-canvas p-6">
      <div className="flex flex-col items-center text-center">
        <span className="mb-4 grid size-11 place-items-center rounded-xl bg-accent text-on-accent">
          <FileSearch className="size-5" />
        </span>
        <h1 className="text-xl font-semibold tracking-tight text-ink">Recall</h1>
        <p className="mt-1 max-w-xs text-sm text-muted">
          Cited answers from your own documents. Try it with a sample in under a minute.
        </p>
      </div>
      <SignIn />
    </main>
  )
}
