import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

// Mirrors --app-bg in index.css, so the browser/PWA chrome (status bar,
// Android gesture nav bar) matches the page instead of defaulting to white.
const APP_BG: Record<Theme, string> = { light: '#faf6f1', dark: '#1a1412' }

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem('theme')
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // localStorage unavailable (private mode, etc.) — fall through to system preference
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', APP_BG[theme])
    try {
      localStorage.setItem('theme', theme)
    } catch {
      // ignore — per-viewer convenience only
    }
  }, [theme])

  function toggle() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }

  return { theme, toggle }
}
