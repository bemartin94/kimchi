import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
        <Link to="/" className="text-lg font-semibold text-neutral-900">
          Recetario
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/browse" className="text-sm text-neutral-600 underline">
            Browse
          </Link>
          <Link to="/profile" className="text-sm text-neutral-600 underline">
            Profile
          </Link>
          <Link to="/add" className="rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white">
            + Add
          </Link>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-sm text-neutral-500 underline"
          >
            Sign out
          </button>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
