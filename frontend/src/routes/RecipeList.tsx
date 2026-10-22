import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { downloadCsv, toCsv } from '../lib/csv'
import { formatIngredient } from '../lib/scale'
import { supabase } from '../lib/supabaseClient'
import type { Category, Recipe } from '../types'

export function RecipeList() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [activeCategory, setActiveCategory] = useState<string | 'all'>('all')
  const [loading, setLoading] = useState(true)

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
    // Recipes/categories SELECT is no longer owner-only at the RLS level (a
    // public profile's rows are also readable, for the Browse feature), so
    // "my recipes" now has to filter explicitly rather than relying on RLS.
    const [{ data: recipeData }, { data: categoryData }] = await Promise.all([
      supabase
        .from('recipes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('categories').select('*').eq('user_id', user.id).order('name'),
    ])
    setRecipes(recipeData ?? [])
    setCategories(categoryData ?? [])
    setLoading(false)
  }

  const visible =
    activeCategory === 'all' ? recipes : recipes.filter((r) => r.category_id === activeCategory)

  function handleExport() {
    const categoryName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? ''
    const rows = recipes.map((r) => [
      r.title,
      categoryName(r.category_id),
      r.ingredients.map((ing) => (typeof ing === 'string' ? ing : formatIngredient(ing))).join('\n'),
      r.steps.map((s, i) => `${i + 1}. ${s}`).join('\n'),
      r.source_url ?? '',
      r.created_at,
    ])
    const csv = toCsv(['Title', 'Category', 'Ingredients', 'Steps', 'Source URL', 'Saved at'], rows)
    downloadCsv('recetario-recipes.csv', csv)
  }

  return (
    <Layout>
      <div className="mx-auto max-w-2xl p-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveCategory('all')}
              className={`shrink-0 rounded-full px-3 py-1 text-sm ${
                activeCategory === 'all' ? 'bg-orange-600 text-white' : 'bg-neutral-200 text-neutral-700'
              }`}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={`shrink-0 rounded-full px-3 py-1 text-sm ${
                  activeCategory === c.id ? 'bg-orange-600 text-white' : 'bg-neutral-200 text-neutral-700'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
          {recipes.length > 0 && (
            <button
              onClick={handleExport}
              className="shrink-0 whitespace-nowrap text-sm text-neutral-500 underline"
            >
              Export CSV
            </button>
          )}
        </div>

        {loading && <p className="text-neutral-500">Loading…</p>}

        {!loading && visible.length === 0 && (
          <div className="mt-12 text-center text-neutral-500">
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
              className="overflow-hidden rounded-lg border border-neutral-200 bg-white"
            >
              {r.thumbnail_url ? (
                <img src={r.thumbnail_url} alt="" className="aspect-video w-full object-cover" />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center bg-neutral-100 text-2xl">
                  🍽️
                </div>
              )}
              <p className="p-2 text-sm font-medium text-neutral-800">{r.title}</p>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  )
}
