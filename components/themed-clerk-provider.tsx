'use client'

import type { ReactNode } from 'react'
import { ClerkProvider } from '@clerk/nextjs'
import { useDarkMode } from './use-dark-mode'

// Hex mirrors of the tokens in app/globals.css. Clerk derives hover and border
// shades from these, so it needs concrete colours rather than var(--…).
const LIGHT = {
  colorPrimary: '#4f46e5',
  colorPrimaryForeground: '#ffffff',
  colorBackground: '#ffffff',
  colorForeground: '#101828',
  colorMutedForeground: '#667085',
  colorInput: '#ffffff',
  colorInputForeground: '#101828',
  colorBorder: '#e4e7ec',
  colorNeutral: '#101828',
}

const DARK = {
  colorPrimary: '#8b8cf8',
  colorPrimaryForeground: '#0c0e13',
  colorBackground: '#13161d',
  colorForeground: '#e6e8ec',
  colorMutedForeground: '#98a1b2',
  colorInput: '#1a1e27',
  colorInputForeground: '#e6e8ec',
  colorBorder: '#262b36',
  colorNeutral: '#e6e8ec',
}

/** ClerkProvider whose sign-in card and user menu follow the app's theme. */
export function ThemedClerkProvider({ children }: { children: ReactNode }) {
  const dark = useDarkMode()

  return (
    <ClerkProvider
      appearance={{
        variables: {
          ...(dark ? DARK : LIGHT),
          borderRadius: '0.625rem',
          fontFamily: 'var(--font-geist-sans)',
        },
      }}
    >
      {children}
    </ClerkProvider>
  )
}
