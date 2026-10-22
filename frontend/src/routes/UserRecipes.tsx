import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { supabase } from '../lib/supabaseClient'
import { syncRecipeTags, tagsOf } from '../lib/tags'
import type { Profile, Recipe } from '../types'

export function UserRecipes() {
  const { id } = useParams()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [isSelf, setIsSelf] = useState(false)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [id])

  async function load() {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    setIsSelf(user?.id === id)

    const [{ data: profileData }, { data: recipeData }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase
        .from('recipes')
        .select('*, recipe_tags(tags(*))')
        .eq('user_id', id)
        .order('created_at', { ascending: false }),
    ])
    setProfile(profileData ?? null)
    setRecipes(recipeData ?? [])
    setLoading(false)
  }

  async function handleSave(recipe: Recipe) {
    setSavingId(recipe.id)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    const { data: inserted, error } = await supabase
      .from('recipes')
      .insert({
        user_id: user.id,
        source_url: recipe.source_url,
        title: recipe.title,
        thumbnail_url: recipe.thumbnail_url,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
      })
      .select()
      .single()
    if (!error && inserted) {
      const tagNames = tagsOf(recipe).map((t) => t.name)
      await syncRecipeTags(inserted.id, user.id, tagNames)
      setSavedIds((prev) => new Set(prev).add(recipe.id))
    }
    setSavingId(null)
  }

  if (loading) {
    return (
      <Layout>
        <p className="p-6 text-neutral-500">Loading…</p>
      </Layout>
    )
  }

  const title = profile?.display_name || 'This user'

  if (!isSelf && profile && !profile.is_public) {
    return (
      <Layout>
        <div className="mx-auto max-w-md p-6 text-center text-neutral-500">
          <p>{title}'s profile is private.</p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="mx-auto max-w-2xl p-4">
        <h1 className="mb-4 text-xl font-semibold text-neutral-900">{title}'s recipes</h1>

        {recipes.length === 0 && <p className="text-sm text-neutral-500">No recipes yet.</p>}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {recipes.map((r) => (
            <div key={r.id} className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
              {r.thumbnail_url ? (
                <img src={r.thumbnail_url} alt="" className="aspect-video w-full object-cover" />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center bg-neutral-100 text-2xl">
                  🍽️
                </div>
              )}
              <p className="p-2 text-sm font-medium text-neutral-800">{r.title}</p>
              {!isSelf && (
                <button
                  onClick={() => handleSave(r)}
                  disabled={savingId === r.id || savedIds.has(r.id)}
                  className="w-full border-t border-neutral-200 py-1.5 text-xs font-medium text-orange-600 disabled:text-neutral-400"
                >
                  {savedIds.has(r.id) ? 'Saved ✓' : savingId === r.id ? 'Saving…' : 'Save to my recipes'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  )
}
