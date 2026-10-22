import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useTheme } from '../lib/useTheme'

export function Layout({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme()

  return (
    <div className="min-h-dvh bg-app-bg">
      <header className="flex items-center justify-between border-b border-line bg-card px-4 py-3">
        <Link to="/" className="text-lg font-semibold text-ink">
          Recetario
        </Link>
        <div className="flex items-center gap-3">
          <button onClick={toggle} aria-label="Toggle dark mode" className="text-sm text-muted">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <Link to="/profile" className="text-sm text-muted underline">
            Profile
          </Link>
          <Link
            to="/add"
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-hover"
          >
            + Add
          </Link>
          <button onClick={() => supabase.auth.signOut()} className="text-sm text-muted underline">
            Sign out
          </button>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
