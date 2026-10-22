import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthProvider } from './lib/AuthContext'
import { AddRecipe } from './routes/AddRecipe'
import { Auth } from './routes/Auth'
import { EditRecipe } from './routes/EditRecipe'
import { Profile } from './routes/Profile'
import { PublicRecipe } from './routes/PublicRecipe'
import { RecipeDetail } from './routes/RecipeDetail'
import { RecipeList } from './routes/RecipeList'
import { ResetPassword } from './routes/ResetPassword'
import { ShareTarget } from './routes/ShareTarget'
import { UserRecipes } from './routes/UserRecipes'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/r/:token" element={<PublicRecipe />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <RecipeList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/add"
            element={
              <ProtectedRoute>
                <AddRecipe />
              </ProtectedRoute>
            }
          />
          <Route
            path="/share-target"
            element={
              <ProtectedRoute>
                <ShareTarget />
              </ProtectedRoute>
            }
          />
          <Route
            path="/recipes/:id"
            element={
              <ProtectedRoute>
                <RecipeDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/recipes/:id/edit"
            element={
              <ProtectedRoute>
                <EditRecipe />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users/:id"
            element={
              <ProtectedRoute>
                <UserRecipes />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
