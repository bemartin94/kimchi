import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { extractRecipe } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import { syncRecipeTags, tagsOf } from '../lib/tags'
import type { ExtractedRecipe, Ingredient } from '../types'

const BLANK_RECIPE: ExtractedRecipe = {
  title: '',
  tags: [],
  ingredients: [{ quantity: null, unit: null, item: '' }],
  steps: [''],
  thumbnailUrl: null,
  author: null,
}

interface Props {
  /** Triggers AI extraction from a video/website URL. */
  sourceUrl?: string
  /** Edits an existing saved recipe instead of creating a new one. */
  recipeId?: string
}

/** Omit both sourceUrl and recipeId for a blank manual-entry form. */
export function RecipeReviewForm({ sourceUrl, recipeId }: Props) {
  const navigate = useNavigate()
  const [extracting, setExtracting] = useState(!!sourceUrl || !!recipeId)
  const [error, setError] = useState<string | null>(null)
  const [recipe, setRecipe] = useState<ExtractedRecipe | null>(sourceUrl || recipeId ? null : BLANK_RECIPE)
  const [existingTags, setExistingTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const startedRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Guards against React StrictMode's dev-only double-invoke, which would
    // otherwise fire a paid extraction call (or a duplicate fetch) twice per mount.
    if (startedRef.current) return
    startedRef.current = true

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return

      // Tags SELECT is no longer owner-only at the RLS level (a public
      // profile's rows are also readable), so "my tags" for the AI hint has
      // to filter explicitly.
      supabase
        .from('tags')
        .select('name')
        .eq('user_id', user.id)
        .order('name')
        .then(({ data }) => {
          const existingTagNames = (data ?? []).map((t) => t.name)
          setExistingTags(existingTagNames)

          if (recipeId) {
            supabase
              .from('recipes')
              .select('*, recipe_tags(tags(*))')
              .eq('id', recipeId)
              .eq('user_id', user.id)
              .single()
              .then(({ data: existingRecipe, error: fetchError }) => {
                if (fetchError || !existingRecipe) {
                  setError('Could not load that recipe.')
                  setExtracting(false)
                  return
                }
                setRecipe({
                  title: existingRecipe.title,
                  tags: tagsOf(existingRecipe).map((t) => t.name),
                  ingredients: existingRecipe.ingredients,
                  steps: existingRecipe.steps,
                  thumbnailUrl: existingRecipe.thumbnail_url,
                  author: existingRecipe.author,
                })
                setExtracting(false)
              })
            return
          }

          if (!sourceUrl) return

          extractRecipe(sourceUrl, existingTagNames)
            .then((result) => setRecipe(result))
            .catch((err) => setError(err instanceof Error ? err.message : 'Extraction failed.'))
            .finally(() => setExtracting(false))
        })
    })
  }, [sourceUrl, recipeId])

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

  function addTag() {
    if (!recipe) return
    const name = tagInput.trim()
    if (!name) return
    const canonical = existingTags.find((t) => t.toLowerCase() === name.toLowerCase()) ?? name
    setExistingTags((prev) => (prev.some((t) => t.toLowerCase() === canonical.toLowerCase()) ? prev : [...prev, canonical]))
    if (!recipe.tags.some((t) => t.toLowerCase() === canonical.toLowerCase())) {
      setRecipe({ ...recipe, tags: [...recipe.tags, canonical] })
    }
    setTagInput('')
  }

  async function handlePhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow picking the same file again later
    if (!file || !recipe) return

    setUploadingPhoto(true)
    setError(null)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in.')

      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('recipe-images').upload(path, file)
      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('recipe-images').getPublicUrl(path)
      setRecipe((r) => (r ? { ...r, thumbnailUrl: data.publicUrl } : r))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Photo upload failed.')
    } finally {
      setUploadingPhoto(false)
    }
  }

  function toggleTag(name: string) {
    if (!recipe) return
    const has = recipe.tags.some((t) => t.toLowerCase() === name.toLowerCase())
    setRecipe({
      ...recipe,
      tags: has ? recipe.tags.filter((t) => t.toLowerCase() !== name.toLowerCase()) : [...recipe.tags, name],
    })
  }

  async function handleSave() {
    if (!recipe) return
    if (!recipe.title.trim()) {
      setError('Give the recipe a title first.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('Not signed in.')

      const ingredients = recipe.ingredients.filter((ing) => ing.item.trim() || ing.quantity != null)
      const steps = recipe.steps.map((s) => s.trim()).filter(Boolean)

      if (recipeId) {
        const { error } = await supabase
          .from('recipes')
          .update({
            title: recipe.title,
            thumbnail_url: recipe.thumbnailUrl,
            author: recipe.author,
            ingredients,
            steps,
          })
          .eq('id', recipeId)
        if (error) throw error
        await syncRecipeTags(recipeId, user.id, recipe.tags)
        navigate(`/recipes/${recipeId}`)
        return
      }

      const { data: inserted, error } = await supabase
        .from('recipes')
        .insert({
          user_id: user.id,
          source_url: sourceUrl ?? null,
          title: recipe.title,
          thumbnail_url: recipe.thumbnailUrl,
          author: recipe.author,
          ingredients,
          steps,
        })
        .select()
        .single()
      if (error) throw error
      await syncRecipeTags(inserted.id, user.id, recipe.tags)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const allTagOptions = useMemo(() => {
    const byLower = new Map<string, string>()
    for (const t of existingTags) byLower.set(t.toLowerCase(), t)
    for (const t of recipe?.tags ?? []) if (!byLower.has(t.toLowerCase())) byLower.set(t.toLowerCase(), t)
    return [...byLower.values()]
  }, [existingTags, recipe?.tags])

  if (extracting) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-muted">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p>{recipeId ? 'Loading recipe…' : 'Reading the recipe and writing it up…'}</p>
      </div>
    )
  }

  if (error && !recipe) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <p className="mb-4 text-destructive-ink">{error}</p>
        {!recipeId && (
          <p className="text-sm text-muted">
            This can happen if a video has no captions/transcript, or a website blocks automated
            requests, so there's nothing to turn into a recipe.
          </p>
        )}
        <button onClick={() => navigate('/')} className="mt-6 rounded-lg border border-line px-4 py-2 text-ink">
          Back home
        </button>
      </div>
    )
  }

  if (!recipe) return null

  return (
    <div className="mx-auto max-w-md p-4">
      <button
        onClick={() => navigate(recipeId ? `/recipes/${recipeId}` : '/')}
        className="mb-3 text-sm text-muted underline"
      >
        ← Cancel
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoFile}
        className="hidden"
      />

      {recipe.thumbnailUrl ? (
        <div className="relative mb-4">
          <img
            src={recipe.thumbnailUrl}
            alt=""
            className="w-full rounded-lg object-cover"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingPhoto}
            className="absolute bottom-2 right-2 rounded-full bg-card/90 px-3 py-1.5 text-xs font-medium text-ink shadow disabled:opacity-60"
          >
            {uploadingPhoto ? 'Uploading…' : 'Change photo'}
          </button>
        </div>
      ) : (
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingPhoto}
          className="mb-4 flex aspect-video w-full items-center justify-center rounded-lg border border-dashed border-line text-sm text-muted disabled:opacity-60"
        >
          {uploadingPhoto ? 'Uploading…' : '+ Add photo'}
        </button>
      )}

      <input
        className="mb-3 w-full rounded-lg border border-line bg-card px-3 py-2 text-lg font-medium text-ink"
        placeholder="Recipe title"
        value={recipe.title}
        onChange={(e) => setRecipe({ ...recipe, title: e.target.value })}
      />

      <input
        className="mb-4 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink"
        placeholder="Author (optional)"
        value={recipe.author ?? ''}
        onChange={(e) => setRecipe({ ...recipe, author: e.target.value || null })}
      />

      <h2 className="mb-1 font-semibold text-ink">Ingredients</h2>
      <p className="mb-2 text-xs text-muted">
        {sourceUrl
          ? 'Imperial units (lb/oz/cup/tbsp/tsp) were converted to grams or ml. Scaling is available on the recipe page after saving.'
          : 'Tip: use metric units (g/ml) if you want scaling to work smoothly later.'}
      </p>
      <div className="mb-2 flex flex-col gap-1.5">
        {recipe.ingredients.map((ing, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input
              type="number"
              inputMode="decimal"
              className="w-16 rounded-lg border border-line bg-card px-2 py-1.5 text-sm text-ink"
              placeholder="qty"
              value={ing.quantity ?? ''}
              onChange={(e) =>
                updateIngredient(i, { quantity: e.target.value === '' ? null : Number(e.target.value) })
              }
            />
            <input
              className="w-16 rounded-lg border border-line bg-card px-2 py-1.5 text-sm text-ink"
              placeholder="unit"
              value={ing.unit ?? ''}
              onChange={(e) => updateIngredient(i, { unit: e.target.value || null })}
            />
            <input
              className="min-w-0 flex-1 rounded-lg border border-line bg-card px-2 py-1.5 text-sm text-ink"
              placeholder="ingredient"
              value={ing.item}
              onChange={(e) => updateIngredient(i, { item: e.target.value })}
            />
            <button
              onClick={() => removeIngredient(i)}
              className="shrink-0 px-1.5 text-muted"
              aria-label="Remove ingredient"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button onClick={addIngredient} className="mb-4 text-sm text-primary-ink underline">
        + Add ingredient
      </button>

      <h2 className="mb-1 font-semibold text-ink">Steps</h2>
      <textarea
        className="mb-4 w-full rounded-lg border border-line bg-card px-3 py-2 text-ink"
        placeholder="One step per line"
        rows={Math.min(14, recipe.steps.length + 1)}
        value={recipe.steps.join('\n')}
        onChange={(e) => setRecipe({ ...recipe, steps: e.target.value.split('\n') })}
      />

      <h2 className="mb-1 font-semibold text-ink">Tags</h2>
      {sourceUrl && <p className="mb-1 text-xs text-muted">3 tags suggested automatically — edit as you like.</p>}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {allTagOptions.map((tag) => {
          const on = recipe.tags.some((t) => t.toLowerCase() === tag.toLowerCase())
          return (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`rounded-full px-3 py-1 text-sm ${on ? 'bg-primary text-white' : 'bg-pill text-pill-ink'}`}
            >
              {tag}
            </button>
          )
        })}
      </div>
      <div className="mb-4 flex gap-1.5">
        <input
          className="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-2 text-ink"
          placeholder="New tag"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              addTag()
            }
          }}
        />
        <button
          onClick={addTag}
          className="shrink-0 whitespace-nowrap rounded-lg border border-line px-3 text-sm font-medium text-primary-ink"
        >
          + Tag
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-destructive-ink">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-lg bg-primary px-4 py-3 font-medium text-white hover:bg-primary-hover disabled:opacity-50"
      >
        {saving ? 'Saving…' : recipeId ? 'Save changes' : 'Save recipe'}
      </button>
    </div>
  )
}
