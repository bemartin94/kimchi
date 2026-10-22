/** Formats a scaled quantity for display: whole numbers plain, else one decimal place. */
export function formatQuantity(quantity: number): string {
  const rounded = Math.round(quantity * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}
