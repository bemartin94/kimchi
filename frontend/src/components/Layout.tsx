import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTheme } from '../lib/useTheme'
import { BottomNav } from './BottomNav'

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.5M12 19.5V22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M2 12h2.5M19.5 12H22M4.93 19.07l1.77-1.77M17.3 6.7l1.77-1.77" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme()

  return (
    <div className="min-h-dvh bg-app-bg">
      <header className="flex items-center justify-between border-b border-line bg-card px-4 py-3">
        <Link to="/" className="text-lg font-semibold text-ink">
          Recetario
        </Link>
        <button
          onClick={toggle}
          aria-label="Toggle dark mode"
          className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-line bg-card text-ink"
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </header>
      <main className="pb-20">{children}</main>
      <BottomNav />
    </div>
  )
}
