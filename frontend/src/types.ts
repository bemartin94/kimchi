export interface Category {
  id: string
  user_id: string
  name: string
  created_at: string
}

export interface Ingredient {
  /** Already scaled to the recipe's base (1x) serving. Null for non-quantifiable items like "salt to taste". */
  quantity: number | null
  /** Short unit token, e.g. "g", "ml", "clove", "pinch". Null when there's no unit (e.g. "2 eggs"). */
  unit: string | null
  item: string
}

export interface Recipe {
  id: string
  user_id: string
  category_id: string | null
  source_url: string | null
  video_id: string | null
  title: string
  thumbnail_url: string | null
  ingredients: Ingredient[]
  steps: string[]
  raw_transcript: string | null
  created_at: string
}

export interface ExtractedRecipe {
  title: string
  /** AI-suggested category: an existing category name verbatim, or a new short one. */
  category: string
  ingredients: Ingredient[]
  steps: string[]
  thumbnailUrl: string | null
}
