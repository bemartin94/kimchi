import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTheme } from '../lib/useTheme'
import { BottomNav } from './BottomNav'

export function Layout({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme()

  return (
    <div className="min-h-dvh bg-app-bg">
      <header className="flex items-center justify-between border-b border-line bg-card px-4 py-3">
        <Link to="/" className="text-lg font-semibold text-ink">
          Recetario
        </Link>
        <button onClick={toggle} aria-label="Toggle dark mode" className="text-sm text-muted">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </header>
      <main className="pb-20">{children}</main>
      <BottomNav />
    </div>
  )
}
