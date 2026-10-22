import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useTheme } from '../lib/useTheme'

export function Layout({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme()

  return (
    <div className="min-h-dvh bg-neutral-50 dark:bg-neutral-900">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
        <Link to="/" className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          Recetario
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={toggle}
            aria-label="Toggle dark mode"
            className="text-sm text-neutral-600 dark:text-neutral-300"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <Link to="/profile" className="text-sm text-neutral-600 underline dark:text-neutral-300">
            Profile
          </Link>
          <Link to="/add" className="rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white">
            + Add
          </Link>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-sm text-neutral-500 underline dark:text-neutral-400"
          >
            Sign out
          </button>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
