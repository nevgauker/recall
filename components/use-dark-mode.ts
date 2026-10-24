'use client'

import { useSyncExternalStore } from 'react'

// The source of truth is the `.dark` class on <html>, set before first paint
// by the script in app/layout.tsx and flipped by ThemeToggle. Subscribing to
// it (rather than copying it into state) keeps every reader in sync.
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => observer.disconnect()
}

const isDark = () => document.documentElement.classList.contains('dark')

export function useDarkMode(): boolean {
  return useSyncExternalStore(subscribe, isDark, () => false)
}
