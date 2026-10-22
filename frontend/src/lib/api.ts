import type { ExtractedRecipe } from '../types'
import { supabase } from './supabaseClient'

/** Calls the `extract-recipe` Edge Function: a YouTube video or recipe-website URL -> structured recipe. */
export async function extractRecipe(url: string, existingTags: string[]): Promise<ExtractedRecipe> {
  const { data, error } = await supabase.functions.invoke<ExtractedRecipe>('extract-recipe', {
    body: { url, existingTags },
  })

  if (error) {
    // supabase-js surfaces non-2xx responses as a generic error; try to recover
    // the function's own error message from the response body when present.
    const context = (error as { context?: Response }).context
    if (context) {
      try {
        const body = await context.clone().json()
        if (body?.error) throw new Error(body.error)
      } catch {
        // fall through to the generic error below
      }
    }
    throw new Error(error.message)
  }

  if (!data) throw new Error('No recipe data returned.')
  return data
}
