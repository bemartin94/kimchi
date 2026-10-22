import { useEffect, useRef, useState } from 'react'

/** Keeps the screen on via the Wake Lock API (e.g. for "Cooking Mode"). Not supported in every browser. */
export function useWakeLock() {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator
  const [active, setActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sentinelRef = useRef<WakeLockSentinel | null>(null)

  async function enable() {
    if (!supported) return
    setError(null)
    try {
      const sentinel = await navigator.wakeLock.request('screen')
      sentinelRef.current = sentinel
      setActive(true)
      sentinel.addEventListener('release', () => setActive(false))
    } catch (err) {
      setActive(false)
      setError(err instanceof Error ? `${err.name}: ${err.message}` : 'Failed to enable.')
    }
  }

  function disable() {
    sentinelRef.current?.release()
    sentinelRef.current = null
    setActive(false)
  }

  useEffect(() => {
    // The wake lock is released automatically when the tab becomes hidden
    // (e.g. phone screen locks mid-cook) — re-acquire it when it's visible again.
    function handleVisibility() {
      if (active && document.visibilityState === 'visible' && !sentinelRef.current) {
        enable()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      sentinelRef.current?.release()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  return { supported, active, error, enable, disable }
}
