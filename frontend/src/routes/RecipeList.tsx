import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Layout } from '../components/Layout'
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
    const [{ data: recipeData }, { data: categoryData }] = await Promise.all([
      supabase.from('recipes').select('*').order('created_at', { ascending: false }),
      supabase.from('categories').select('*').order('name'),
    ])
    setRecipes(recipeData ?? [])
    setCategories(categoryData ?? [])
    setLoading(false)
  }

  const visible =
    activeCategory === 'all' ? recipes : recipes.filter((r) => r.category_id === activeCategory)

  return (
    <Layout>
      <div className="mx-auto max-w-2xl p-4">
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
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
