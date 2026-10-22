import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { formatIngredient } from '../lib/scale'
import { supabase } from '../lib/supabaseClient'
import { useWakeLock } from '../lib/useWakeLock'
import type { Recipe } from '../types'

const SCALE_PRESETS = [0.5, 1, 2, 3]

function isYouTubeUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname
    return host.includes('youtube.com') || host.includes('youtu.be')
  } catch {
    return false
  }
}

function publicUrlFor(token: string): string {
  return `${window.location.origin}/r/${token}`
}

export function RecipeDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [scale, setScale] = useState(1)
  const [customScale, setCustomScale] = useState('')
  const [shareFeedback, setShareFeedback] = useState<string | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const wakeLock = useWakeLock()

  useEffect(() => {
    Promise.all([
      supabase.auth.getUser(),
      supabase.from('recipes').select('*').eq('id', id).single(),
    ]).then(([{ data: userData }, { data: recipeData }]) => {
      setRecipe(recipeData)
      setIsOwner(!!userData.user && recipeData?.user_id === userData.user.id)
      setLoading(false)
    })
  }, [id])

  // Don't leave the screen pinned on if the user navigates away mid-cook.
  useEffect(() => () => wakeLock.disable(), []) // eslint-disable-line react-hooks/exhaustive-deps

  async function getOrCreateShareToken(): Promise<string> {
    if (recipe?.share_token) return recipe.share_token
    const token = crypto.randomUUID()
    const { error } = await supabase.from('recipes').update({ share_token: token }).eq('id', id)
    if (error) throw error
    setRecipe((r) => (r ? { ...r, share_token: token } : r))
    return token
  }

  async function handleShare() {
    if (!recipe) return
    try {
      const token = await getOrCreateShareToken()
      const url = publicUrlFor(token)
      if (navigator.share) {
        try {
          await navigator.share({ title: recipe.title, text: recipe.title, url })
        } catch {
          // user cancelled the share sheet — nothing to do
        }
        return
      }
      await navigator.clipboard.writeText(url)
      setShareFeedback('Public link copied to clipboard!')
      setTimeout(() => setShareFeedback(null), 2500)
    } catch (err) {
      setShareFeedback(err instanceof Error ? err.message : 'Could not create a share link.')
    }
  }

  async function handleStopSharing() {
    if (!recipe) return
    const { error } = await supabase.from('recipes').update({ share_token: null }).eq('id', id)
    if (!error) setRecipe((r) => (r ? { ...r, share_token: null } : r))
  }

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
        <div className="mb-1 flex items-start justify-between gap-2">
          <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">{recipe.title}</h1>
          {isOwner && (
            <button
              onClick={handleShare}
              className="shrink-0 rounded-full bg-neutral-200 px-3 py-1 text-sm text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
            >
              Share
            </button>
          )}
        </div>
        {shareFeedback && <p className="mb-2 text-xs text-green-700 dark:text-green-400">{shareFeedback}</p>}
        {isOwner && recipe.share_token && (
          <div className="mb-2 flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
            <span className="truncate">{publicUrlFor(recipe.share_token)}</span>
            <button onClick={handleStopSharing} className="shrink-0 text-red-600 underline dark:text-red-400">
              Stop sharing
            </button>
          </div>
        )}
        {recipe.source_url && (
          <a
            href={recipe.source_url}
            target="_blank"
            rel="noreferrer"
            className="mb-4 inline-block text-sm text-orange-600 underline dark:text-orange-400"
          >
            {isYouTubeUrl(recipe.source_url) ? 'Watch original video' : 'View original recipe'}
          </a>
        )}

        <div className="mb-4 rounded-lg border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-700 dark:bg-neutral-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">Cooking Mode</p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {wakeLock.supported ? 'Keeps your screen from locking' : 'Not supported in this browser'}
              </p>
            </div>
            <button
              disabled={!wakeLock.supported}
              onClick={() => (wakeLock.active ? wakeLock.disable() : wakeLock.enable())}
              className={`rounded-full px-3 py-1 text-sm disabled:opacity-40 ${
                wakeLock.active
                  ? 'bg-orange-600 text-white'
                  : 'bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300'
              }`}
            >
              {wakeLock.active ? 'On' : 'Off'}
            </button>
          </div>
          {wakeLock.error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{wakeLock.error}</p>}
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Scale:</span>
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
                  : 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
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
            className="w-20 rounded-lg border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-800"
          />
        </div>

        <h2 className="mb-1 font-semibold text-neutral-700 dark:text-neutral-300">
          Ingredients{' '}
          {scale !== 1 && (
            <span className="font-normal text-neutral-400 dark:text-neutral-500">({scale}x)</span>
          )}
        </h2>
        <ul className="mb-4 list-disc pl-5 text-neutral-800 dark:text-neutral-200">
          {recipe.ingredients.map((ing, i) => (
            <li key={i}>{typeof ing === 'string' ? ing : formatIngredient(ing, scale)}</li>
          ))}
        </ul>

        <h2 className="mb-1 font-semibold text-neutral-700 dark:text-neutral-300">Steps</h2>
        {scale !== 1 && (
          <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
            Steps are written for the original batch size — adjust cook times/pan sizes by eye.
          </p>
        )}
        <ol className="mb-6 list-decimal pl-5 text-neutral-800 dark:text-neutral-200">
          {recipe.steps.map((step, i) => (
            <li key={i} className="mb-1">
              {step}
            </li>
          ))}
        </ol>

        {isOwner && (
          <div className="flex gap-4">
            <Link
              to={`/recipes/${recipe.id}/edit`}
              className="text-sm text-orange-600 underline dark:text-orange-400"
            >
              Edit recipe
            </Link>
            <button onClick={handleDelete} className="text-sm text-red-600 underline dark:text-red-400">
              Delete recipe
            </button>
          </div>
        )}
      </div>
    </Layout>
  )
}
