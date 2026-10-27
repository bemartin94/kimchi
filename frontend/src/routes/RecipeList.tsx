import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { supabase } from '../lib/supabaseClient'
import { tagsOf } from '../lib/tags'
import type { Recipe } from '../types'

export function RecipeList() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [activeTag, setActiveTag] = useState<string | 'all'>('all')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }
    // Recipes SELECT is no longer owner-only at the RLS level (a public
    // profile's rows are also readable), so "my recipes" has to filter
    // explicitly rather than relying on RLS.
    const { data: recipeData } = await supabase
      .from('recipes')
      .select('*, recipe_tags(tags(*))')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setRecipes(recipeData ?? [])
    setLoading(false)
  }

  const allTags = useMemo(() => {
    const byId = new Map<string, string>()
    for (const r of recipes) {
      for (const tag of tagsOf(r)) byId.set(tag.id, tag.name)
    }
    return [...byId.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [recipes])

  const query = search.trim().toLowerCase()

  const visible = recipes.filter((r) => {
    if (activeTag !== 'all' && !tagsOf(r).some((t) => t.id === activeTag)) return false
    if (!query) return true
    if (r.title.toLowerCase().includes(query)) return true
    return r.ingredients.some((ing) =>
      (typeof ing === 'string' ? ing : ing.item).toLowerCase().includes(query),
    )
  })

  return (
    <Layout>
      <div className="mx-auto max-w-2xl p-4 pb-28">
        <div className="mb-3 flex items-baseline justify-between">
          <h1 className="text-xl font-semibold text-ink">My recipes</h1>
          <span className="text-sm text-muted">
            {recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'}
          </span>
        </div>

        <div className="scrollbar-none mb-4 flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTag('all')}
            className={`shrink-0 rounded-full px-3 py-1 text-sm ${
              activeTag === 'all' ? 'bg-primary text-white' : 'bg-pill text-pill-ink'
            }`}
          >
            All
          </button>
          {allTags.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTag(t.id)}
              className={`shrink-0 rounded-full px-3 py-1 text-sm ${
                activeTag === t.id ? 'bg-primary text-white' : 'bg-pill text-pill-ink'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>

        {loading && <p className="text-muted">Loading…</p>}

        {!loading && visible.length === 0 && recipes.length > 0 && (
          <div className="mt-12 text-center text-muted">
            <p>No recipes match "{search}".</p>
          </div>
        )}

        {!loading && recipes.length === 0 && (
          <div className="mt-12 text-center text-muted">
            <p>No recipes yet.</p>
            <p className="text-sm">
              Share a recipe from YouTube, or{' '}
              <Link to="/add" className="text-primary-ink underline">
                add one from any recipe website
              </Link>
              .
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {visible.map((r) => (
            <Link
              key={r.id}
              to={`/recipes/${r.id}`}
              className="flex items-center gap-3 overflow-hidden rounded-lg border border-line bg-card p-2"
            >
              {r.thumbnail_url ? (
                <img
                  src={r.thumbnail_url}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-md object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-pill text-2xl">
                  🍽️
                </div>
              )}
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{r.title}</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="fixed bottom-20 left-1/2 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-2.5 rounded-full border border-line bg-card px-4 py-3 shadow-lg shadow-black/10">
        <svg width="18" height="18" viewBox="0 0 18 18" className="shrink-0 text-muted">
          <circle cx="7.5" cy="7.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" />
          <line x1="11.6" y1="11.6" x2="16" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your recipes…"
          className="w-full min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
        />
      </div>
    </Layout>
  )
}
