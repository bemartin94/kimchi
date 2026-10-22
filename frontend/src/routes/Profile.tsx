import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { downloadCsv, toCsv } from '../lib/csv'
import { formatIngredient } from '../lib/scale'
import { supabase } from '../lib/supabaseClient'
import { tagsOf } from '../lib/tags'
import type { Profile as ProfileType, Recipe } from '../types'

export function Profile() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<ProfileType | null>(null)
  const [recipeCount, setRecipeCount] = useState(0)
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedFeedback, setSavedFeedback] = useState(false)
  const [shareFeedback, setShareFeedback] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const [{ data }, { count }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('recipes').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    ])
    if (data) {
      setProfile(data)
      setDisplayName(data.display_name ?? '')
    }
    setRecipeCount(count ?? 0)
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

  async function handleShareProfile() {
    if (!profile) return
    const url = `${window.location.origin}/users/${profile.id}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'My recipes on Recetario', url })
      } catch {
        // user cancelled — nothing to do
      }
      return
    }
    await navigator.clipboard.writeText(url)
    setShareFeedback('Profile link copied to clipboard!')
    setTimeout(() => setShareFeedback(null), 2500)
  }

  async function handleExportCsv() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { data: recipes } = await supabase
      .from('recipes')
      .select('*, recipe_tags(tags(*))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    const rows = (recipes ?? []).map((r: Recipe) => [
      r.title,
      tagsOf(r)
        .map((t) => t.name)
        .join('; '),
      r.ingredients.map((ing) => (typeof ing === 'string' ? ing : formatIngredient(ing))).join('\n'),
      r.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'),
      r.source_url ?? '',
      r.created_at,
    ])
    const csv = toCsv(['Title', 'Tags', 'Ingredients', 'Steps', 'Source URL', 'Saved at'], rows)
    downloadCsv('recetario-recipes.csv', csv)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/auth')
  }

  if (loading) {
    return (
      <Layout>
        <p className="p-6 text-muted">Loading…</p>
      </Layout>
    )
  }

  if (!profile) {
    return (
      <Layout>
        <p className="p-6 text-muted">Could not load your profile.</p>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="mx-auto max-w-md p-4">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-pill text-2xl text-pill-ink">
            {(profile.display_name || 'Y')[0].toUpperCase()}
          </div>
          <p className="text-lg font-semibold text-ink">{profile.display_name || 'Your profile'}</p>
          <p className="text-sm text-muted">
            {recipeCount} {recipeCount === 1 ? 'recipe' : 'recipes'}
          </p>
        </div>

        <label className="mb-1 block text-sm font-medium text-ink">Display name</label>
        <div className="mb-4 flex gap-2">
          <input
            className="flex-1 rounded-lg border border-line bg-card px-3 py-2 text-ink"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <button
            onClick={() => save({ display_name: displayName.trim() || null })}
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:opacity-50"
          >
            Save
          </button>
        </div>

        <div className="mb-4 rounded-lg border border-line bg-card px-3 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ink">Public profile</p>
              <p className="max-w-[220px] text-xs text-muted">
                {profile.is_public
                  ? 'Other signed-in users can browse all of your recipes.'
                  : "Your recipes are private. Others can only see ones you explicitly share via a link."}
              </p>
            </div>
            <button
              onClick={() => save({ is_public: !profile.is_public })}
              disabled={saving}
              className={`shrink-0 rounded-full px-3 py-1 text-sm disabled:opacity-50 ${
                profile.is_public ? 'bg-primary text-white' : 'bg-pill text-pill-ink'
              }`}
            >
              {profile.is_public ? 'Public' : 'Private'}
            </button>
          </div>
        </div>
        {savedFeedback && <p className="mb-4 text-xs text-success-ink">Saved!</p>}

        <button
          onClick={handleShareProfile}
          className="mb-2 w-full rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white hover:bg-primary-hover"
        >
          Share profile
        </button>
        <button
          onClick={handleExportCsv}
          className="mb-6 w-full rounded-lg bg-pill px-4 py-3 text-sm font-medium text-pill-ink"
        >
          Export CSV
        </button>
        {shareFeedback && <p className="mb-4 -mt-4 text-center text-xs text-success-ink">{shareFeedback}</p>}

        <button
          onClick={handleSignOut}
          className="block w-full text-center text-sm text-muted underline"
        >
          Sign out
        </button>
      </div>
    </Layout>
  )
}
