import { supabase } from './supabaseClient'
import type { Recipe, Tag } from '../types'

/** Flattens the nested `recipe_tags(tags(*))` select shape into a plain Tag list. */
export function tagsOf(recipe: Recipe): Tag[] {
  return (recipe.recipe_tags ?? []).map((rt) => rt.tags)
}

/** Finds or creates tags by name for a user, returning their rows (one per distinct trimmed name). */
export async function resolveTags(userId: string, names: string[]): Promise<Tag[]> {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))]
  if (unique.length === 0) return []

  const { data: existing } = await supabase
    .from('tags')
    .select('*')
    .eq('user_id', userId)
    .in('name', unique)

  const resolved: Tag[] = [...(existing ?? [])]
  const existingNamesLower = new Set(resolved.map((t) => t.name.toLowerCase()))
  const missing = unique.filter((n) => !existingNamesLower.has(n.toLowerCase()))

  if (missing.length > 0) {
    const { data: created, error } = await supabase
      .from('tags')
      .insert(missing.map((name) => ({ user_id: userId, name })))
      .select()
    if (error) throw error
    resolved.push(...(created ?? []))
  }

  return resolved
}

/** Replaces a recipe's tags with exactly the given names, creating any new tags as needed. */
export async function syncRecipeTags(recipeId: string, userId: string, names: string[]) {
  const tags = await resolveTags(userId, names)
  await supabase.from('recipe_tags').delete().eq('recipe_id', recipeId)
  if (tags.length > 0) {
    const { error } = await supabase
      .from('recipe_tags')
      .insert(tags.map((tag) => ({ recipe_id: recipeId, tag_id: tag.id })))
    if (error) throw error
  }
}
