import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Layout } from '../components/Layout'
import { formatIngredient } from '../lib/scale'
import { supabase } from '../lib/supabaseClient'
import { tagsOf } from '../lib/tags'
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
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [cooking, setCooking] = useState(false)
  const [step, setStep] = useState(0)
  const [cookFeedback, setCookFeedback] = useState<string | null>(null)
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set())
  const wakeLock = useWakeLock()

  useEffect(() => {
    Promise.all([
      supabase.auth.getUser(),
      supabase.from('recipes').select('*, recipe_tags(tags(*))').eq('id', id).single(),
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

  async function handleDelete() {
    if (!recipe) return
    await supabase.from('recipes').delete().eq('id', recipe.id)
    navigate('/')
  }

  function toggleCooking() {
    if (cooking) {
      setCooking(false)
      wakeLock.disable()
    } else {
      setCooking(true)
      setStep(0)
      wakeLock.enable()
    }
  }

  function toggleIngredient(i: number) {
    setCheckedIngredients((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  function nextStep() {
    if (!recipe) return
    if (step === recipe.steps.length - 1) {
      setCooking(false)
      wakeLock.disable()
      setStep(0)
      setCookFeedback('Enjoy!')
      setTimeout(() => setCookFeedback(null), 2000)
    } else {
      setStep((s) => s + 1)
    }
  }

  if (loading) {
    return (
      <Layout>
        <p className="p-6 text-muted">Loading…</p>
      </Layout>
    )
  }

  if (!recipe) {
    return (
      <Layout>
        <p className="p-6 text-muted">Recipe not found.</p>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="mx-auto max-w-md p-4">
        <Link to="/" className="mb-2 inline-block text-sm font-semibold text-primary-ink">
          ‹ All recipes
        </Link>
        {recipe.thumbnail_url && (
          <img src={recipe.thumbnail_url} alt="" className="mb-4 w-full rounded-lg object-cover" />
        )}
        <div className="mb-1 flex items-start justify-between gap-2">
          <h1 className="text-xl font-semibold text-ink">{recipe.title}</h1>
          {isOwner && (
            <button
              onClick={handleShare}
              className="shrink-0 rounded-full bg-pill px-3 py-1 text-sm text-pill-ink"
            >
              Share
            </button>
          )}
        </div>
        {recipe.author && <p className="mb-1 text-sm text-muted">by {recipe.author}</p>}
        {shareFeedback && <p className="mb-2 text-xs text-success-ink">{shareFeedback}</p>}
        {tagsOf(recipe).length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {tagsOf(recipe).map((tag) => (
              <span
                key={tag.id}
                className="rounded-full bg-pill px-2.5 py-0.5 text-xs text-pill-ink"
              >
                {tag.name}
              </span>
            ))}
          </div>
        )}
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

        <div className="mb-4 rounded-lg border border-line bg-card px-3 py-3">
          <div className="flex flex-wrap items-center gap-2">
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

          <div className="my-3 h-px bg-line" />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ink">Cooking Mode</p>
              <p className="text-xs text-muted">
                {wakeLock.supported ? 'Keeps your screen from locking' : 'Not supported in this browser'}
              </p>
            </div>
            <button
              onClick={toggleCooking}
              className={`rounded-full px-3 py-1 text-sm ${
                cooking ? 'bg-primary text-white' : 'bg-pill text-pill-ink'
              }`}
            >
              {cooking ? 'On' : 'Off'}
            </button>
          </div>
          {wakeLock.error && <p className="mt-2 text-xs text-destructive-ink">{wakeLock.error}</p>}
        </div>

        <h2 className="mb-1 font-semibold text-ink">
          Ingredients {scale !== 1 && <span className="font-normal text-muted">({scale}x)</span>}
        </h2>
        <ul className="mb-4 flex flex-col gap-1.5">
          {recipe.ingredients.map((ing, i) => {
            const checked = checkedIngredients.has(i)
            return (
              <li key={i}>
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleIngredient(i)}
                    className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-primary"
                  />
                  <span className={checked ? 'text-muted line-through' : 'text-ink'}>
                    {typeof ing === 'string' ? ing : formatIngredient(ing, scale)}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>

        <h2 className="mb-1 font-semibold text-ink">Method</h2>
        {scale !== 1 && !cooking && (
          <p className="mb-2 text-xs text-muted">
            Steps are written for the original batch size — adjust cook times/pan sizes by eye.
          </p>
        )}

        {cooking ? (
          <div className="mb-6 rounded-lg border border-line bg-card p-4">
            <p className="text-xs font-semibold text-primary-ink">
              Step {step + 1} of {recipe.steps.length}
            </p>
            <p className="mt-2 text-lg leading-snug text-ink">{recipe.steps[step]}</p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                className="flex-1 rounded-lg border border-line py-2 text-sm font-semibold text-ink disabled:opacity-40"
              >
                Back
              </button>
              <button
                onClick={nextStep}
                className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-white hover:bg-primary-hover"
              >
                {step === recipe.steps.length - 1 ? 'Done' : 'Next'}
              </button>
            </div>
          </div>
        ) : (
          <ol className="mb-6 flex flex-col gap-2">
            {recipe.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className={`font-bold ${i % 2 === 0 ? 'text-primary-ink' : 'text-emphasis'}`}>
                  {i + 1}.
                </span>
                <span className="text-ink">{s}</span>
              </li>
            ))}
          </ol>
        )}
        {cookFeedback && <p className="mb-4 text-sm text-success-ink">{cookFeedback}</p>}

        {isOwner && !confirmingDelete && (
          <div className="flex gap-4">
            <Link to={`/recipes/${recipe.id}/edit`} className="text-sm text-primary-ink underline">
              Edit recipe
            </Link>
            <button onClick={() => setConfirmingDelete(true)} className="text-sm text-destructive-ink underline">
              Delete recipe
            </button>
          </div>
        )}
        {isOwner && confirmingDelete && (
          <div className="flex items-center gap-2 rounded-lg border border-line bg-card px-3 py-2">
            <span className="flex-1 text-sm text-ink">Delete this recipe?</span>
            <button onClick={() => setConfirmingDelete(false)} className="px-2 py-1 text-sm font-semibold text-muted">
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="rounded-lg bg-destructive px-3 py-2 text-sm font-semibold text-white"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </Layout>
  )
}
