'use client'

import { Moon, Sun } from 'lucide-react'
import { useDarkMode } from './use-dark-mode'

export function ThemeToggle() {
  const dark = useDarkMode()

  function toggle() {
    const next = !dark
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem('recall-theme', next ? 'dark' : 'light')
    } catch {
      // Private windows can refuse storage; the toggle still works for this visit.
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="grid size-9 place-items-center rounded-lg text-muted transition hover:bg-subtle hover:text-ink"
    >
      {dark ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
    </button>
  )
}
