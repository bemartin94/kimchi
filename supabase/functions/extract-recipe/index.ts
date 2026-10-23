// Supabase Edge Function (Deno runtime).
// Given a recipe URL — a YouTube video OR any recipe website — produces a
// structured recipe (title/tags/ingredients/steps/thumbnail) with
// ingredients split into {quantity, unit, item}, deterministically converts
// imperial units (lb/oz -> g, cup/tbsp/tsp/fl oz -> ml), and returns that JSON.
// Suggests exactly 3 tags per recipe.
//
// YouTube: transcript fetched via Supadata (see fetchTranscript below for why
// not YouTube's own endpoint directly). Websites: tries schema.org JSON-LD
// Recipe data first (what most recipe sites embed for Google rich snippets —
// high quality, no AI guessing needed for the raw ingredients/steps text),
// falling back to scraping the page's visible text if no JSON-LD is found.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

class TranscriptUnavailableError extends Error {}
class SourceUnavailableError extends Error {}

function extractYouTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname.includes('youtu.be')) return u.pathname.slice(1) || null
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v')
      const m = u.pathname.match(/\/shorts\/([^/]+)/)
      if (m) return m[1]
    }
    return null
  } catch {
    return null
  }
}

// ---------- YouTube transcript ----------

interface SupadataTranscriptResponse {
  content: string
  lang: string
  availableLangs: string[]
}

interface SupadataJobResponse {
  jobId?: string
  status?: 'queued' | 'active' | 'completed' | 'failed'
  content?: string
  error?: string
}

async function fetchTranscript(youtubeUrl: string): Promise<string> {
  const apiKey = Deno.env.get('SUPADATA_API_KEY')
  if (!apiKey) throw new Error('SUPADATA_API_KEY is not configured.')

  const res = await fetch(
    `https://api.supadata.ai/v1/transcript?url=${encodeURIComponent(youtubeUrl)}&text=true`,
    { headers: { 'x-api-key': apiKey } },
  )

  if (res.status === 404 || res.status === 403) {
    throw new TranscriptUnavailableError('This video is private, restricted, or not found.')
  }

  if (res.status === 202) {
    const { jobId } = (await res.json()) as SupadataJobResponse
    if (!jobId) throw new Error('Supadata returned 202 without a jobId.')
    return await pollJob(jobId, apiKey)
  }

  if (!res.ok) {
    throw new Error(`Supadata API error: ${res.status} ${await res.text()}`)
  }

  const data = (await res.json()) as SupadataTranscriptResponse
  if (!data.content) {
    throw new TranscriptUnavailableError('No transcript is available for this video.')
  }
  return data.content
}

async function pollJob(jobId: string, apiKey: string): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1500))
    const res = await fetch(`https://api.supadata.ai/v1/transcript/${jobId}`, {
      headers: { 'x-api-key': apiKey },
    })
    const data = (await res.json()) as SupadataJobResponse
    if (data.status === 'completed') {
      if (!data.content) throw new TranscriptUnavailableError('No transcript is available for this video.')
      return data.content
    }
    if (data.status === 'failed') {
      throw new TranscriptUnavailableError(data.error ?? 'Transcript generation failed.')
    }
  }
  throw new Error('Timed out waiting for the transcript to be ready.')
}

// ---------- Recipe websites ----------

interface SourceContent {
  text: string
  thumbnailUrl: string | null
}

function firstImageUrl(image: unknown): string | null {
  if (!image) return null
  if (typeof image === 'string') return image
  if (Array.isArray(image)) return firstImageUrl(image[0])
  if (typeof image === 'object' && image !== null && 'url' in image) {
    return typeof (image as { url: unknown }).url === 'string' ? (image as { url: string }).url : null
  }
  return null
}

function flattenInstructions(instructions: unknown): string[] {
  if (!instructions) return []
  if (typeof instructions === 'string') return [instructions]
  if (Array.isArray(instructions)) {
    return instructions.flatMap((step) => {
      if (typeof step === 'string') return [step]
      if (step && typeof step === 'object') {
        if ('itemListElement' in step) return flattenInstructions((step as { itemListElement: unknown }).itemListElement)
        if ('text' in step && typeof (step as { text: unknown }).text === 'string') {
          return [(step as { text: string }).text]
        }
      }
      return []
    })
  }
  return []
}

/** Recursively searches parsed JSON-LD for an object whose @type includes "Recipe". */
function findRecipeNode(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipeNode(item)
      if (found) return found
    }
    return null
  }
  const obj = node as Record<string, unknown>
  const type = obj['@type']
  const types = Array.isArray(type) ? type : [type]
  if (types.some((t) => typeof t === 'string' && t.toLowerCase() === 'recipe')) return obj
  if ('@graph' in obj) return findRecipeNode(obj['@graph'])
  return null
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchWebpageContent(url: string): Promise<SourceContent> {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })
  if (!res.ok) {
    throw new SourceUnavailableError(`Could not fetch that page (HTTP ${res.status}).`)
  }
  const html = await res.text()

  const jsonLdBlocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  for (const match of jsonLdBlocks) {
    try {
      const parsed = JSON.parse(match[1].trim())
      const recipeNode = findRecipeNode(parsed)
      if (recipeNode) {
        const ingredients = Array.isArray(recipeNode.recipeIngredient)
          ? (recipeNode.recipeIngredient as unknown[]).map(String)
          : []
        const instructions = flattenInstructions(recipeNode.recipeInstructions)
        const text =
          `Title: ${String(recipeNode.name ?? '')}\n\n` +
          `Ingredients:\n${ingredients.join('\n')}\n\n` +
          `Instructions:\n${instructions.join('\n')}`
        return { text, thumbnailUrl: firstImageUrl(recipeNode.image) }
      }
    } catch {
      // not valid/relevant JSON-LD — try the next block
    }
  }

  // No structured recipe data found — fall back to the page's visible text.
  const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
  return { text: stripHtml(html).slice(0, 20000), thumbnailUrl: ogImageMatch?.[1] ?? null }
}

// ---------- Unit conversion (deterministic — the AI never does the math) ----------

interface RawIngredient {
  quantity: number | null
  unit: string | null
  item: string
}

const WEIGHT_TO_GRAMS: Record<string, number> = {
  lb: 453.592,
  lbs: 453.592,
  pound: 453.592,
  pounds: 453.592,
  oz: 28.3495,
  ounce: 28.3495,
  ounces: 28.3495,
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
  g: 1,
  gram: 1,
  grams: 1,
}

const VOLUME_TO_ML: Record<string, number> = {
  cup: 236.588,
  cups: 236.588,
  tbsp: 14.7868,
  tablespoon: 14.7868,
  tablespoons: 14.7868,
  tsp: 4.92892,
  teaspoon: 4.92892,
  teaspoons: 4.92892,
  'fl oz': 29.5735,
  'fluid ounce': 29.5735,
  'fluid ounces': 29.5735,
  quart: 946.353,
  quarts: 946.353,
  pint: 473.176,
  pints: 473.176,
  gallon: 3785.41,
  gallons: 3785.41,
  ml: 1,
  milliliter: 1,
  milliliters: 1,
  l: 1000,
  liter: 1000,
  liters: 1000,
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

/** Converts a raw {quantity, unit} to metric (grams for weight, ml for volume) when possible. */
function normalizeIngredient(raw: RawIngredient): RawIngredient {
  if (raw.quantity == null || !raw.unit) return raw
  const unit = raw.unit.trim().toLowerCase()

  if (unit in WEIGHT_TO_GRAMS) {
    const grams = raw.quantity * WEIGHT_TO_GRAMS[unit]
    return { ...raw, quantity: roundTo(grams, grams < 10 ? 1 : 0), unit: 'g' }
  }
  if (unit in VOLUME_TO_ML) {
    const ml = raw.quantity * VOLUME_TO_ML[unit]
    return { ...raw, quantity: roundTo(ml, ml < 10 ? 1 : 0), unit: 'ml' }
  }
  return raw
}

// ---------- AI structuring (title/tags/ingredients/steps only — no unit math) ----------

interface StructuredRecipe {
  title: string
  tags: string[]
  ingredients: RawIngredient[]
  steps: string[]
}

/** Retries once if ingredients came back but steps didn't — the model occasionally
 *  drops the steps array on a given attempt even though the source clearly has them. */
async function structureRecipe(sourceText: string, existingTags: string[]): Promise<StructuredRecipe> {
  const first = await structureRecipeOnce(sourceText, existingTags)
  if (first.steps.length > 0 || first.ingredients.length === 0) return first

  const retry = await structureRecipeOnce(sourceText, existingTags)
  return retry.steps.length > 0 ? retry : first
}

async function structureRecipeOnce(sourceText: string, existingTags: string[]): Promise<StructuredRecipe> {
  const apiKey = Deno.env.get('GROQ_API_KEY')
  if (!apiKey) throw new Error('GROQ_API_KEY is not configured.')

  const tagHint =
    existingTags.length > 0
      ? `The user's existing tags are: ${JSON.stringify(existingTags)}. ` +
        'Reuse any of these that clearly fit this recipe (exact name), and fill any remaining slots with new short tags.'
      : 'Suggest short, lowercase, single-or-two-word tags (e.g. "dinner", "dessert", "quick", "vegetarian", "spicy").'

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-120b',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You turn raw recipe source text (a cooking video transcript, or scraped recipe-website content) into a clean recipe. ' +
            'Respond with ONLY a JSON object: ' +
            '{"title": string, "tags": string[], "ingredients": [{"quantity": number|null, "unit": string|null, "item": string}], "steps": string[]}. ' +
            '"tags" must have EXACTLY 3 short tags describing this recipe (meal type, cuisine, diet, main ingredient, or cooking method). ' +
            '\n\nFor each ingredient, pull out quantity and unit exactly as stated, for EVERY ingredient that has a stated amount — ' +
            'this includes small amounts of sauces, oils, and spices (e.g. "3 tbsp soy sauce"), not just the main proteins/vegetables. ' +
            'One ingredient = one line; if the same ingredient is restated in two units, merge it into a single line. ' +
            'Report the unit exactly as said (lb, oz, cup, tbsp, tsp, clove, etc.) — do not convert units yourself, that happens elsewhere. ' +
            'Only use quantity null and unit null when the source truly gives no amount at all (vague phrasing like "a glug of soy sauce", or "salt to taste"). ' +
            'Do not invent a specific number for those vague cases — null is correct and expected for them. ' +
            '\n\nSteps should be short, numbered-in-order instructions. ' +
            `${tagHint} ` +
            'If the source text clearly contains no recipe at all, respond with empty ingredients/steps arrays rather than inventing one. ' +
            'Do not invent ingredients that are never mentioned.',
        },
        { role: 'user', content: sourceText.slice(0, 15000) },
      ],
    }),
  })

  if (!res.ok) {
    throw new Error(`Groq API error: ${res.status} ${await res.text()}`)
  }

  const completion = await res.json()
  const content = completion.choices?.[0]?.message?.content
  if (!content) throw new Error('Groq returned no content.')

  const parsed = JSON.parse(content)
  const rawIngredients: RawIngredient[] = Array.isArray(parsed.ingredients)
    ? parsed.ingredients.map((ing: Record<string, unknown>) => ({
        quantity: typeof ing.quantity === 'number' ? ing.quantity : null,
        unit: typeof ing.unit === 'string' ? ing.unit : null,
        item: String(ing.item ?? ''),
      }))
    : []

  const tags = Array.isArray(parsed.tags) ? parsed.tags.map(String).filter(Boolean) : []

  return {
    title: String(parsed.title ?? 'Untitled recipe'),
    tags: tags.slice(0, 3),
    ingredients: rawIngredients.map(normalizeIngredient),
    steps: Array.isArray(parsed.steps) ? parsed.steps.map(String) : [],
  }
}

function youTubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url, existingTags } = await req.json()
    if (!url) return jsonResponse({ error: 'Missing url.' }, 400)

    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return jsonResponse({ error: 'That does not look like a valid URL.' }, 400)
    }

    const tags = Array.isArray(existingTags) ? existingTags.map(String) : []
    const videoId = extractYouTubeVideoId(url)

    let sourceText: string
    let thumbnailUrl: string | null

    if (videoId) {
      sourceText = await fetchTranscript(url)
      thumbnailUrl = youTubeThumbnail(videoId)
    } else {
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return jsonResponse({ error: 'Only http(s) URLs are supported.' }, 400)
      }
      const content = await fetchWebpageContent(url)
      sourceText = content.text
      thumbnailUrl = content.thumbnailUrl
    }

    const recipe = await structureRecipe(sourceText, tags)
    return jsonResponse({ ...recipe, thumbnailUrl })
  } catch (err) {
    if (err instanceof TranscriptUnavailableError) {
      return jsonResponse({ error: err.message }, 422)
    }
    if (err instanceof SourceUnavailableError) {
      return jsonResponse({ error: err.message }, 422)
    }
    console.error(err)
    return jsonResponse({ error: err instanceof Error ? err.message : 'Unexpected error.' }, 500)
  }
})
