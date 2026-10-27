import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { formatIngredient } from '../lib/scale'
import { supabase } from '../lib/supabaseClient'
import { useWakeLock } from '../lib/useWakeLock'
import type { SharedRecipe } from '../types'

const SCALE_PRESETS = [0.5, 1, 2, 3]

function isYouTubeUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname
    return host.includes('youtube.com') || host.includes('youtu.be')
  } catch {
    return false
  }
}

/** Public, no-login-required view of a recipe someone shared a link to. */
export function PublicRecipe() {
  const { token } = useParams()
  const [recipe, setRecipe] = useState<SharedRecipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [scale, setScale] = useState(1)
  const [customScale, setCustomScale] = useState('')
  const wakeLock = useWakeLock()

  useEffect(() => {
    supabase
      .rpc('get_shared_recipe', { token })
      .then(({ data }) => {
        setRecipe(Array.isArray(data) && data.length > 0 ? data[0] : null)
        setLoading(false)
      })
  }, [token])

  useEffect(() => () => wakeLock.disable(), []) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return <p className="p-6 text-muted">Loading…</p>
  }

  if (!recipe) {
    return (
      <div className="mx-auto max-w-md p-6 text-center text-muted">
        <p>This link isn't shared anymore, or never existed.</p>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-app-bg">
      <header className="border-b border-line bg-card px-4 py-3">
        <span className="text-lg font-semibold text-ink">mis recetas</span>
        <span className="ml-2 text-xs text-muted">shared recipe</span>
      </header>

      <div className="mx-auto max-w-md p-4">
        {recipe.thumbnail_url && (
          <img src={recipe.thumbnail_url} alt="" className="mb-4 w-full rounded-lg object-cover" />
        )}
        <h1 className="mb-1 text-xl font-semibold text-ink">{recipe.title}</h1>
        {recipe.author && <p className="mb-1 text-sm text-muted">by {recipe.author}</p>}
        {recipe.source_url && (
          <a
            href={recipe.source_url}
            target="_blank"
            rel="noreferrer"
            className="mb-4 inline-block text-sm text-primary-ink underline"
          >
            {isYouTubeUrl(recipe.source_url) ? 'Watch original video' : 'View original recipe'}
          </a>
        )}

        <div className="mb-4 flex items-center justify-between rounded-lg border border-line bg-card px-3 py-2">
          <div>
            <p className="text-sm font-medium text-ink">Cooking Mode</p>
            <p className="text-xs text-muted">
              {wakeLock.supported ? 'Keeps your screen from locking' : 'Not supported in this browser'}
            </p>
          </div>
          <button
            disabled={!wakeLock.supported}
            onClick={() => (wakeLock.active ? wakeLock.disable() : wakeLock.enable())}
            className={`rounded-full px-3 py-1 text-sm disabled:opacity-40 ${
              wakeLock.active ? 'bg-primary text-white' : 'bg-pill text-pill-ink'
            }`}
          >
            {wakeLock.active ? 'On' : 'Off'}
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-ink">Scale:</span>
          {SCALE_PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => {
                setScale(p)
                setCustomScale('')
              }}
              className={`rounded-full px-3 py-1 text-sm ${
                scale === p && customScale === '' ? 'bg-emphasis text-white' : 'bg-pill text-pill-ink'
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
            className="w-20 rounded-lg border border-line bg-card px-2 py-1 text-sm text-ink"
          />
        </div>

        <h2 className="mb-1 font-semibold text-ink">
          Ingredients {scale !== 1 && <span className="font-normal text-muted">({scale}x)</span>}
        </h2>
        <ul className="mb-4 list-disc pl-5 text-ink">
          {recipe.ingredients.map((ing, i) => (
            <li key={i}>{typeof ing === 'string' ? ing : formatIngredient(ing, scale)}</li>
          ))}
        </ul>

        <h2 className="mb-1 font-semibold text-ink">Steps</h2>
        <ol className="mb-6 list-decimal pl-5 text-ink">
          {recipe.steps.map((step, i) => (
            <li key={i} className="mb-1">
              {step}
            </li>
          ))}
        </ol>

        <p className="text-center text-sm text-muted">
          Saved with{' '}
          <Link to="/" className="text-primary-ink underline">
            mis recetas
          </Link>
        </p>
      </div>
    </div>
  )
}
