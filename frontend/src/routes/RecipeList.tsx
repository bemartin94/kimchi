import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { downloadCsv, toCsv } from '../lib/csv'
import { formatIngredient } from '../lib/scale'
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

  function handleExport() {
    const rows = recipes.map((r) => [
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

  return (
    <Layout>
      <div className="mx-auto max-w-2xl p-4 pb-24">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveTag('all')}
              className={`shrink-0 rounded-full px-3 py-1 text-sm ${
                activeTag === 'all'
                  ? 'bg-orange-600 text-white'
                  : 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
              }`}
            >
              All
            </button>
            {allTags.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTag(t.id)}
                className={`shrink-0 rounded-full px-3 py-1 text-sm ${
                  activeTag === t.id
                    ? 'bg-orange-600 text-white'
                    : 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
          {recipes.length > 0 && (
            <button
              onClick={handleExport}
              className="shrink-0 whitespace-nowrap text-sm text-neutral-500 underline dark:text-neutral-400"
            >
              Export CSV
            </button>
          )}
        </div>

        {loading && <p className="text-neutral-500 dark:text-neutral-400">Loading…</p>}

        {!loading && visible.length === 0 && recipes.length > 0 && (
          <div className="mt-12 text-center text-neutral-500 dark:text-neutral-400">
            <p>No recipes match "{search}".</p>
          </div>
        )}

        {!loading && recipes.length === 0 && (
          <div className="mt-12 text-center text-neutral-500 dark:text-neutral-400">
            <p>No recipes yet.</p>
            <p className="text-sm">
              Share a recipe from YouTube, or{' '}
              <Link to="/add" className="text-orange-600 underline">
                add one from any recipe website
              </Link>
              .
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visible.map((r) => (
            <Link
              key={r.id}
              to={`/recipes/${r.id}`}
              className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800"
            >
              {r.thumbnail_url ? (
                <img src={r.thumbnail_url} alt="" className="aspect-video w-full object-cover" />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center bg-neutral-100 text-2xl dark:bg-neutral-700">
                  🍽️
                </div>
              )}
              <p className="p-2 text-sm font-medium text-neutral-800 dark:text-neutral-200">{r.title}</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="fixed bottom-4 left-1/2 w-[calc(100%-2rem)] max-w-md -translate-x-1/2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search your recipes…"
          className="w-full rounded-full border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 shadow-lg shadow-black/10 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
        />
      </div>
    </Layout>
  )
}
