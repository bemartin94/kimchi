import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { formatQuantity } from '../lib/scale'
import { supabase } from '../lib/supabaseClient'
import { useWakeLock } from '../lib/useWakeLock'
import type { Ingredient, Recipe } from '../types'

const SCALE_PRESETS = [0.5, 1, 2, 3]

function formatIngredient(ing: Ingredient, scale: number): string {
  const parts: string[] = []
  if (ing.quantity != null) parts.push(formatQuantity(ing.quantity * scale))
  if (ing.unit) parts.push(ing.unit)
  parts.push(ing.item)
  return parts.join(' ')
}

function isYouTubeUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname
    return host.includes('youtube.com') || host.includes('youtu.be')
  } catch {
    return false
  }
}

export function RecipeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [scale, setScale] = useState(1)
  const [customScale, setCustomScale] = useState('')
  const wakeLock = useWakeLock()

  useEffect(() => {
    supabase
      .from('recipes')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setRecipe(data)
        setLoading(false)
      })
  }, [id])

  // Don't leave the screen pinned on if the user navigates away mid-cook.
  useEffect(() => () => wakeLock.disable(), []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete() {
    if (!recipe) return
    if (!confirm('Delete this recipe?')) return
    await supabase.from('recipes').delete().eq('id', recipe.id)
    navigate('/')
  }

  if (loading) {
    return (
      <Layout>
        <p className="p-6 text-neutral-500">Loading…</p>
      </Layout>
    )
  }

  if (!recipe) {
    return (
      <Layout>
        <p className="p-6 text-neutral-500">Recipe not found.</p>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="mx-auto max-w-md p-4">
        {recipe.thumbnail_url && (
          <img src={recipe.thumbnail_url} alt="" className="mb-4 w-full rounded-lg object-cover" />
        )}
        <h1 className="mb-1 text-xl font-semibold text-neutral-900">{recipe.title}</h1>
        <a
          href={recipe.source_url}
          target="_blank"
          rel="noreferrer"
          className="mb-4 inline-block text-sm text-orange-600 underline"
        >
          {isYouTubeUrl(recipe.source_url) ? 'Watch original video' : 'View original recipe'}
        </a>

        <div className="mb-4 flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-3 py-2">
          <div>
            <p className="text-sm font-medium text-neutral-800">Cooking Mode</p>
            <p className="text-xs text-neutral-500">
              {wakeLock.supported ? 'Keeps your screen from locking' : 'Not supported in this browser'}
            </p>
          </div>
          <button
            disabled={!wakeLock.supported}
            onClick={() => (wakeLock.active ? wakeLock.disable() : wakeLock.enable())}
            className={`rounded-full px-3 py-1 text-sm disabled:opacity-40 ${
              wakeLock.active ? 'bg-orange-600 text-white' : 'bg-neutral-200 text-neutral-700'
            }`}
          >
            {wakeLock.active ? 'On' : 'Off'}
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-neutral-700">Scale:</span>
          {SCALE_PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => {
                setScale(p)
                setCustomScale('')
              }}
              className={`rounded-full px-3 py-1 text-sm ${
                scale === p && customScale === ''
                  ? 'bg-orange-600 text-white'
                  : 'bg-neutral-200 text-neutral-700'
              }`}
            >
              {p}x
            </button>
          ))}
          <input
            type="number"
            inputMode="decimal"
            min="0.1"
            step="0.1"
            placeholder="custom"
            value={customScale}
            onChange={(e) => {
              setCustomScale(e.target.value)
              const n = Number(e.target.value)
              if (e.target.value !== '' && n > 0) setScale(n)
            }}
            className="w-20 rounded-lg border border-neutral-300 px-2 py-1 text-sm"
          />
        </div>

        <h2 className="mb-1 font-semibold text-neutral-700">
          Ingredients {scale !== 1 && <span className="font-normal text-neutral-400">({scale}x)</span>}
        </h2>
        <ul className="mb-4 list-disc pl-5 text-neutral-800">
          {recipe.ingredients.map((ing, i) => (
            <li key={i}>{typeof ing === 'string' ? ing : formatIngredient(ing, scale)}</li>
          ))}
        </ul>

        <h2 className="mb-1 font-semibold text-neutral-700">Steps</h2>
        {scale !== 1 && (
          <p className="mb-2 text-xs text-neutral-500">
            Steps are written for the original batch size — adjust cook times/pan sizes by eye.
          </p>
        )}
        <ol className="mb-6 list-decimal pl-5 text-neutral-800">
          {recipe.steps.map((step, i) => (
            <li key={i} className="mb-1">
              {step}
            </li>
          ))}
        </ol>

        <button onClick={handleDelete} className="text-sm text-red-600 underline">
          Delete recipe
        </button>
      </div>
    </Layout>
  )
}
