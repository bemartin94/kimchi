import { Link, useLocation } from 'react-router-dom'

function RecipesIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="1" y="1" width="8" height="8" rx="2" fill="currentColor" />
      <rect x="11" y="1" width="8" height="8" rx="2" fill="currentColor" />
      <rect x="1" y="11" width="8" height="8" rx="2" fill="currentColor" />
      <rect x="11" y="11" width="8" height="8" rx="2" fill="currentColor" />
    </svg>
  )
}

function ProfileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="6" r="4" fill="currentColor" />
      <path d="M2 18c0-4 3.6-7 8-7s8 3 8 7" fill="currentColor" />
    </svg>
  )
}

export function BottomNav() {
  const { pathname } = useLocation()
  const onRecipes = pathname === '/' || pathname.startsWith('/recipes/')
  const onProfile = pathname === '/profile'

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex items-start justify-around border-t border-line bg-card px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2">
      <Link
        to="/"
        className={`flex flex-1 flex-col items-center gap-1 text-[11px] font-semibold ${
          onRecipes ? 'text-primary-ink' : 'text-muted'
        }`}
      >
        <span className="flex h-[30px] items-center justify-center">
          <RecipesIcon />
        </span>
        Recipes
      </Link>
      <Link to="/add" aria-label="Add recipe" className="flex flex-1 flex-col items-center gap-1 text-[11px] font-semibold text-muted">
        <span className="flex h-[30px] w-11 items-center justify-center rounded-full bg-primary text-white">
          <span className="relative block h-3.5 w-3.5">
            <span className="absolute left-1/2 top-1/2 h-0.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded bg-white" />
            <span className="absolute left-1/2 top-1/2 h-3.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded bg-white" />
          </span>
        </span>
        Add
      </Link>
      <Link
        to="/profile"
        className={`flex flex-1 flex-col items-center gap-1 text-[11px] font-semibold ${
          onProfile ? 'text-primary-ink' : 'text-muted'
        }`}
      >
        <span className="flex h-[30px] items-center justify-center">
          <ProfileIcon />
        </span>
        Profile
      </Link>
    </nav>
  )
}
