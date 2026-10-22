import { useSearchParams } from 'react-router-dom'
import { RecipeReviewForm } from '../components/RecipeReviewForm'
import { isValidHttpUrl } from '../lib/url'

export function ShareTarget() {
  const [params] = useSearchParams()
  // Android's share sheet puts the shared link in EXTRA_TEXT, which Chrome
  // maps to either `text` or `url` depending on the Android/Chrome version —
  // check both, falling back to whichever one actually contains a URL.
  const candidate = params.get('url') || params.get('text') || ''

  if (!isValidHttpUrl(candidate)) {
    return (
      <div className="mx-auto max-w-md p-6 text-center text-neutral-600">
        <p>Couldn't find a link in what was shared.</p>
        <p className="mt-2 text-sm text-neutral-400">Received: {candidate || '(nothing)'}</p>
      </div>
    )
  }

  return <RecipeReviewForm sourceUrl={candidate} />
}
