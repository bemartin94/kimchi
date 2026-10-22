import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { extractRecipe } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import type { Category, ExtractedRecipe, Ingredient } from '../types'

export function RecipeReviewForm({ sourceUrl }: { sourceUrl: string }) {
  const navigate = useNavigate()
  const [extracting, setExtracting] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recipe, setRecipe] = useState<ExtractedRecipe | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [categoryId, setCategoryId] = useState<string>('')
  const [newCategory, setNewCategory] = useState('')
  const [saving, setSaving] = useState(false)
  const extractionStarted = useRef(false)

  useEffect(() => {
    // Guards against React StrictMode's dev-only double-invoke, which would
    // otherwise fire this paid extraction call twice per mount.
    if (extractionStarted.current) return
    extractionStarted.current = true

    supabase
      .from('categories')
      .select('*')
      .order('name')
      .then(({ data }) => {
        const existing = data ?? []
        setCategories(existing)

        extractRecipe(
          sourceUrl,
          existing.map((c) => c.name),
        )
          .then((result) => {
            setRecipe(result)
            const match = existing.find((c) => c.name.toLowerCase() === result.category.toLowerCase())
            if (match) {
              setCategoryId(match.id)
            } else {
              setCategoryId('')
              setNewCategory(result.category)
            }
          })
          .catch((err) => setError(err instanceof Error ? err.message : 'Extraction failed.'))
          .finally(() => setExtracting(false))
      })
  }, [sourceUrl])

  function updateIngredient(index: number, patch: Partial<Ingredient>) {
    if (!recipe) return
    const ingredients = recipe.ingredients.map((ing, i) => (i === index ? { ...ing, ...patch } : ing))
    setRecipe({ ...recipe, ingredients })
  }

  function removeIngredient(index: number) {
    if (!recipe) return
    setRecipe({ ...recipe, ingredients: recipe.ingredients.filter((_, i) => i !== index) })
  }

  function addIngredient() {
    if (!recipe) return
    setRecipe({ ...recipe, ingredients: [...recipe.ingredients, { quantity: null, unit: null, item: '' }] })
  }

  async function handleSave() {
    if (!recipe) return
    setSaving(true)
    setError(null)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in.')

      let finalCategoryId = categoryId || null
      if (!finalCategoryId && newCategory.trim()) {
        const { data, error } = await supabase
          .from('categories')
          .insert({ name: newCategory.trim(), user_id: user.id })
          .select()
          .single()
        if (error) throw error
        finalCategoryId = data.id
      }

      const { error } = await supabase.from('recipes').insert({
        user_id: user.id,
        category_id: finalCategoryId,
        source_url: sourceUrl,
        title: recipe.title,
        thumbnail_url: recipe.thumbnailUrl,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
      })
      if (error) throw error
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  if (extracting) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-neutral-500">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-600 border-t-transparent" />
        <p>Reading the recipe and writing it up…</p>
      </div>
    )
  }

  if (error && !recipe) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="mb-4 text-red-600">{error}</p>
        <p className="text-sm text-neutral-500">
          This can happen if a video has no captions/transcript, or a website blocks automated
          requests, so there's nothing to turn into a recipe.
        </p>
        <button
          onClick={() => navigate('/')}
          className="mt-6 rounded-lg border border-neutral-300 px-4 py-2"
        >
          Back home
        </button>
      </div>
    )
  }

  if (!recipe) return null

  return (
    <div className="mx-auto max-w-md p-4">
      {recipe.thumbnailUrl && (
        <img
          src={recipe.thumbnailUrl}
          alt=""
          className="mb-4 w-full rounded-lg object-cover"
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
      )}

      <input
        className="mb-3 w-full rounded-lg border border-neutral-300 px-3 py-2 text-lg font-medium"
        value={recipe.title}
        onChange={(e) => setRecipe({ ...recipe, title: e.target.value })}
      />

      <h2 className="mb-1 font-semibold text-neutral-700">Ingredients</h2>
      <p className="mb-2 text-xs text-neutral-500">
        Imperial units (lb/oz/cup/tbsp/tsp) were converted to grams or ml. Scaling is available on the
        recipe page after saving.
      </p>
      <div className="mb-2 flex flex-col gap-1.5">
        {recipe.ingredients.map((ing, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input
              type="number"
              inputMode="decimal"
              className="w-16 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
              placeholder="qty"
              value={ing.quantity ?? ''}
              onChange={(e) =>
                updateIngredient(i, { quantity: e.target.value === '' ? null : Number(e.target.value) })
              }
            />
            <input
              className="w-16 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
              placeholder="unit"
              value={ing.unit ?? ''}
              onChange={(e) => updateIngredient(i, { unit: e.target.value || null })}
            />
            <input
              className="flex-1 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
              placeholder="ingredient"
              value={ing.item}
              onChange={(e) => updateIngredient(i, { item: e.target.value })}
            />
            <button
              onClick={() => removeIngredient(i)}
              className="shrink-0 px-1.5 text-neutral-400"
              aria-label="Remove ingredient"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button onClick={addIngredient} className="mb-4 text-sm text-orange-600 underline">
        + Add ingredient
      </button>

      <h2 className="mb-1 font-semibold text-neutral-700">Steps</h2>
      <textarea
        className="mb-4 w-full rounded-lg border border-neutral-300 px-3 py-2"
        rows={Math.min(14, recipe.steps.length + 1)}
        value={recipe.steps.join('\n')}
        onChange={(e) => setRecipe({ ...recipe, steps: e.target.value.split('\n') })}
      />

      <h2 className="mb-1 font-semibold text-neutral-700">Category</h2>
      <p className="mb-1 text-xs text-neutral-500">Suggested automatically — change it if it's wrong.</p>
      <select
        className="mb-2 w-full rounded-lg border border-neutral-300 px-3 py-2"
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
      >
        <option value="">New category…</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      {!categoryId && (
        <input
          className="mb-4 w-full rounded-lg border border-neutral-300 px-3 py-2"
          placeholder="e.g. Desserts"
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
        />
      )}

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-lg bg-orange-600 px-4 py-3 font-medium text-white disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save recipe'}
      </button>
    </div>
  )
}
