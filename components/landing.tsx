import Link from 'next/link'
import {
  ArrowRight,
  Ban,
  FileSearch,
  Gauge,
  Github,
  Lock,
  MessageSquareText,
  Quote,
  ShieldCheck,
  Upload,
} from 'lucide-react'
import { MessageList } from './chat'
import { ThemeToggle } from './theme-toggle'
import type { Message } from './types'

const REPO_URL = 'https://github.com/nevgauker/recall'

/** Optional "work with me" call to action; hidden unless configured. */
const CONTACT_URL = process.env.NEXT_PUBLIC_CONTACT_URL

/** A real exchange with the sample handbook, rendered with the app's own components. */
const PREVIEW: Message[] = [
  { role: 'user', content: 'If I start on 1 October, how many vacation days do I get for that year?' },
  {
    role: 'assistant',
    content:
      'Vacation in your first year is **prorated by full months employed** [1]. Starting on 1 October gives you three full months:\n\n- 25 days × 3/12 = **6.25 days** for that year\n- Up to 5 unused days carry over, but must be used by 31 March [2]',
    sources: [
      {
        name: 'Sample: Halden & Pike Employee Handbook',
        excerpt:
          'Full-time employees receive 25 vacation days per year, plus the public holidays of the country where their office is located. In your first calendar year, vacation is prorated...',
        similarity: 0.52,
      },
      {
        name: 'Sample: Halden & Pike Employee Handbook',
        excerpt:
          'Up to 5 unused days can be carried over into the following year and must be used by 31 March, after which they expire...',
        similarity: 0.41,
      },
    ],
  },
  { role: 'user', content: 'What is the CEO’s salary?' },
  { role: 'assistant', content: "I couldn't find this in the uploaded documents.", sources: [] },
]

const FEATURES = [
  {
    icon: Quote,
    title: 'Every answer is cited',
    body: 'Claims link to the passage they came from, so you can check rather than trust.',
  },
  {
    icon: Ban,
    title: 'Says “I don’t know”',
    body: 'If the answer isn’t in your documents, Recall declines instead of inventing one.',
  },
  {
    icon: Lock,
    title: 'Your documents stay yours',
    body: 'Retrieval is scoped to the signed-in user in the database query itself, and tested against a real database.',
  },
  {
    icon: ShieldCheck,
    title: 'Safe web import',
    body: 'Imported URLs are checked on every redirect so they can’t reach private networks or cloud metadata.',
  },
  {
    icon: Gauge,
    title: 'Measured, not guessed',
    body: 'An evaluation suite tracks accuracy, refusals and cost per question, and caught a retrieval bug before users did.',
  },
  {
    icon: MessageSquareText,
    title: 'PDFs, text and web pages',
    body: 'Upload a PDF, paste text or import a page, then ask follow-up questions in plain language.',
  },
]

const STATS = [
  { value: '23 / 23', label: 'answerable questions correct' },
  { value: '6 / 6', label: 'unanswerable questions declined' },
  { value: '100%', label: 'of answers cite a source' },
  { value: '$0.003', label: 'per question' },
]

function PrimaryCta({ children = 'Try the live demo' }: { children?: string }) {
  return (
    <Link
      href="/sign-up"
      className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-medium text-on-accent shadow-sm transition hover:bg-accent-hover"
    >
      {children}
      <ArrowRight className="size-4" />
    </Link>
  )
}

export function Landing() {
  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 md:px-6">
          <span className="grid size-8 place-items-center rounded-lg bg-accent text-on-accent">
            <FileSearch className="size-4" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">Recall</span>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <Link
              href="/sign-in"
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-subtle hover:text-ink"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="hidden rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-on-accent transition hover:bg-accent-hover sm:inline-flex"
            >
              Try it free
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-16 md:px-6 lg:grid-cols-[1fr_1.05fr] lg:pt-20 lg:pb-24">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Live demo · sample document included
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-balance md:text-5xl">
              Ask your documents. <span className="text-accent">Get answers you can check.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
              Recall answers only from the files you give it, cites the passage behind every claim, and tells you
              when the answer isn’t there.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <PrimaryCta />
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-5 py-3 text-sm font-medium text-ink transition hover:bg-subtle"
              >
                <Github className="size-4" />
                See how it’s built
              </a>
            </div>
            <p className="mt-4 text-sm text-muted">Free to try. No file needed: load the sample handbook in one click.</p>
          </div>

          {/* Product preview, built from the app's own components */}
          <div className="relative">
            <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-accent/10 blur-2xl" aria-hidden />
            <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-xl">
              <div className="flex items-center gap-2 border-b border-line px-4 py-3">
                <span className="size-2.5 rounded-full bg-line" />
                <span className="size-2.5 rounded-full bg-line" />
                <span className="size-2.5 rounded-full bg-line" />
                <span className="ml-3 truncate text-xs text-muted">Halden &amp; Pike Employee Handbook</span>
              </div>
              <div className="pointer-events-none max-h-[460px] overflow-hidden bg-canvas [&>div]:py-6" aria-hidden>
                <MessageList messages={PREVIEW} asking={false} autoScroll={false} />
              </div>
            </div>
          </div>
        </section>

        {/* Evidence */}
        <section className="border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-12 md:px-6">
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              {STATS.map(s => (
                <div key={s.label}>
                  <p className="text-3xl font-semibold tracking-tight">{s.value}</p>
                  <p className="mt-1 text-sm text-muted">{s.label}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-xs text-muted">
              From a 29-question evaluation set run against the sample handbook with gpt-4o.{' '}
              <a
                href={`${REPO_URL}/blob/main/eval/README.md`}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2 hover:text-ink"
              >
                Method and full results
              </a>
              .
            </p>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-6xl px-4 py-20 md:px-6">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">How it works</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              { icon: Upload, title: 'Add a source', body: 'Upload a PDF, paste text, or import a web page.' },
              {
                icon: MessageSquareText,
                title: 'Ask in plain language',
                body: 'Recall finds the most relevant passages and answers from those alone.',
              },
              {
                icon: Quote,
                title: 'Check the sources',
                body: 'Click any citation to see the exact excerpt the answer relied on.',
              },
            ].map(({ icon: Icon, title, body }, i) => (
              <div key={title} className="rounded-2xl border border-line bg-surface p-6">
                <div className="mb-4 flex items-center gap-3">
                  <span className="grid size-7 place-items-center rounded-lg bg-subtle text-sm font-semibold text-muted">
                    {i + 1}
                  </span>
                  <Icon className="size-5 text-accent" />
                </div>
                <h3 className="font-medium">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Trust */}
        <section className="border-t border-line bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-20 md:px-6">
            <h2 className="max-w-2xl text-2xl font-semibold tracking-tight md:text-3xl">
              Built to be trusted, not just to demo well
            </h2>
            <p className="mt-3 max-w-2xl text-muted">
              Most document chatbots stop at “it answered something.” Recall is engineered for the parts that matter
              once real people and real documents are involved.
            </p>
            <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <div key={title}>
                  <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent-ink">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-4 font-medium">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="mx-auto max-w-6xl px-4 py-20 md:px-6">
          <div className="rounded-3xl bg-accent px-6 py-14 text-center text-on-accent md:px-12">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">See it answer in under a minute</h2>
            <p className="mx-auto mt-3 max-w-lg opacity-85">
              Sign up, load the sample handbook, and ask it anything, including questions it can’t answer.
            </p>
            <Link
              href="/sign-up"
              className="mt-8 inline-flex items-center gap-2 rounded-lg bg-surface px-5 py-3 text-sm font-medium text-ink shadow-sm transition hover:bg-subtle"
            >
              Try the live demo
              <ArrowRight className="size-4" />
            </Link>
          </div>

          {CONTACT_URL && (
            <div className="mt-10 flex flex-col items-start justify-between gap-4 rounded-2xl border border-line bg-surface p-6 sm:flex-row sm:items-center">
              <div>
                <h3 className="font-medium">Want this on your company’s documents?</h3>
                <p className="mt-1 text-sm text-muted">
                  Policies, contracts, support docs or internal wikis, built and deployed for your team.
                </p>
              </div>
              <a
                href={CONTACT_URL}
                className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-line px-4 py-2.5 text-sm font-medium transition hover:bg-subtle"
              >
                Get in touch
                <ArrowRight className="size-4" />
              </a>
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6 text-sm text-muted md:px-6">
          <span className="flex items-center gap-2">
            <FileSearch className="size-4" />
            Recall
          </span>
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:text-ink">
            Source on GitHub
          </a>
          <span className="sm:ml-auto">Next.js · Postgres + pgvector · OpenAI · Clerk</span>
        </div>
      </footer>
    </div>
  )
}
