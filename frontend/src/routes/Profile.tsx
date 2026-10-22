import { useEffect, useState } from 'react'
import { Layout } from '../components/Layout'
import { supabase } from '../lib/supabaseClient'
import type { Profile as ProfileType } from '../types'

export function Profile() {
  const [profile, setProfile] = useState<ProfileType | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedFeedback, setSavedFeedback] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    if (data) {
      setProfile(data)
      setDisplayName(data.display_name ?? '')
    }
    setLoading(false)
  }

  async function save(patch: Partial<Pick<ProfileType, 'display_name' | 'is_public'>>) {
    if (!profile) return
    setSaving(true)
    const { data, error } = await supabase
      .from('profiles')
      .update(patch)
      .eq('id', profile.id)
      .select()
      .single()
    if (!error && data) {
      setProfile(data)
      setSavedFeedback(true)
      setTimeout(() => setSavedFeedback(false), 1500)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <Layout>
        <p className="p-6 text-neutral-500">Loading…</p>
      </Layout>
    )
  }

  if (!profile) {
    return (
      <Layout>
        <p className="p-6 text-neutral-500">Could not load your profile.</p>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="mx-auto max-w-md p-4">
        <h1 className="mb-4 text-xl font-semibold text-neutral-900">Your profile</h1>

        <label className="mb-1 block text-sm font-medium text-neutral-700">Display name</label>
        <div className="mb-4 flex gap-2">
          <input
            className="flex-1 rounded-lg border border-neutral-300 px-3 py-2"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <button
            onClick={() => save({ display_name: displayName.trim() || null })}
            disabled={saving}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Save
          </button>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white px-3 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-800">Public profile</p>
              <p className="max-w-[220px] text-xs text-neutral-500">
                {profile.is_public
                  ? 'Other signed-in users can browse all of your recipes.'
                  : "Your recipes are private. Others can only see ones you explicitly share via a link."}
              </p>
            </div>
            <button
              onClick={() => save({ is_public: !profile.is_public })}
              disabled={saving}
              className={`shrink-0 rounded-full px-3 py-1 text-sm disabled:opacity-50 ${
                profile.is_public ? 'bg-orange-600 text-white' : 'bg-neutral-200 text-neutral-700'
              }`}
            >
              {profile.is_public ? 'Public' : 'Private'}
            </button>
          </div>
        </div>
        {savedFeedback && <p className="mt-2 text-xs text-green-700">Saved!</p>}
      </div>
    </Layout>
  )
}
