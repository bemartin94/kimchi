import type { Ingredient } from '../types'

/** Formats a scaled quantity for display: whole numbers plain, else one decimal place. */
export function formatQuantity(quantity: number): string {
  const rounded = Math.round(quantity * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

export function formatIngredient(ing: Ingredient, scale = 1): string {
  const parts: string[] = []
  if (ing.quantity != null) parts.push(formatQuantity(ing.quantity * scale))
  if (ing.unit) parts.push(ing.unit)
  parts.push(ing.item)
  return parts.join(' ')
}
