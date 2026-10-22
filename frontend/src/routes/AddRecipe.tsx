import { useState } from 'react'
import { RecipeReviewForm } from '../components/RecipeReviewForm'
import { isValidHttpUrl } from '../lib/url'

export function AddRecipe() {
  const [mode, setMode] = useState<'link' | 'manual'>('link')
  const [url, setUrl] = useState('')
  const [submittedUrl, setSubmittedUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValidHttpUrl(url)) {
      setError("That doesn't look like a valid URL.")
      return
    }
    setError(null)
    setSubmittedUrl(url)
  }

  if (mode === 'manual') {
    return <RecipeReviewForm />
  }

  if (submittedUrl) {
    return <RecipeReviewForm sourceUrl={submittedUrl} />
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-xl font-semibold text-neutral-900">Add a recipe</h1>

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setMode('link')}
          className="rounded-full bg-orange-600 px-3 py-1 text-sm text-white"
        >
          From a link
        </button>
        <button
          onClick={() => setMode('manual')}
          className="rounded-full bg-neutral-200 px-3 py-1 text-sm text-neutral-700"
        >
          Enter manually
        </button>
      </div>

      <p className="mb-4 text-sm text-neutral-500">
        Paste a link from any recipe website, or a YouTube video.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="url"
          required
          placeholder="https://..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="rounded-lg border border-neutral-300 px-3 py-2"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" className="rounded-lg bg-orange-600 px-3 py-2 font-medium text-white">
          Extract recipe
        </button>
      </form>
    </div>
  )
}
