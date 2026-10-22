import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { supabase } from '../lib/supabaseClient'
import type { Profile } from '../types'

export function Browse() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .auth.getUser()
      .then(async ({ data: { user } }) => {
        const { data } = await supabase.from('profiles').select('*').eq('is_public', true)
        setProfiles((data ?? []).filter((p) => p.id !== user?.id))
        setLoading(false)
      })
  }, [])

  return (
    <Layout>
      <div className="mx-auto max-w-md p-4">
        <h1 className="mb-1 text-xl font-semibold text-neutral-900">Browse</h1>
        <p className="mb-4 text-sm text-neutral-500">Other users who've made their recipes public.</p>

        {loading && <p className="text-neutral-500">Loading…</p>}

        {!loading && profiles.length === 0 && (
          <p className="text-sm text-neutral-500">No public profiles yet.</p>
        )}

        <div className="flex flex-col gap-2">
          {profiles.map((p) => (
            <Link
              key={p.id}
              to={`/users/${p.id}`}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-3 text-neutral-800"
            >
              {p.display_name || 'Unnamed user'}
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  )
}
