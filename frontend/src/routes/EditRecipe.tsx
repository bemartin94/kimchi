import { useParams } from 'react-router-dom'
import { RecipeReviewForm } from '../components/RecipeReviewForm'

export function EditRecipe() {
  const { id } = useParams()
  if (!id) return null
  return <RecipeReviewForm recipeId={id} />
}
