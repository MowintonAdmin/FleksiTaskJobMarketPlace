import { useEffect, useRef, useState } from 'react'

/**
 * Pausable polling hook for Worker Web app.
 * Calls `fetchFn` every `intervalMs` milliseconds (default 5000).
 * Automatically pauses while the worker is interacting with the page.
 * Resumes 3 seconds after the last interaction.
 */
export default function usePausablePolling(fetchFn, intervalMs = 5000, alwaysPaused = false) {
  const savedCallback = useRef(fetchFn)
  const [paused, setPaused] = useState(false)
  const pauseTimer = useRef(null)

  useEffect(() => {
    savedCallback.current = fetchFn
  }, [fetchFn])

  // Track user interactions on the document
  useEffect(() => {
    const handler = () => {
      setPaused(true)
      clearTimeout(pauseTimer.current)
      pauseTimer.current = setTimeout(() => setPaused(false), 3000)
    }

    document.addEventListener('keydown', handler, true)
    document.addEventListener('click', handler, true)
    document.addEventListener('focusin', handler, true)

    return () => {
      document.removeEventListener('keydown', handler, true)
      document.removeEventListener('click', handler, true)
      document.removeEventListener('focusin', handler, true)
      clearTimeout(pauseTimer.current)
    }
  }, [])

  useEffect(() => {
    if (paused || alwaysPaused) return

    const id = setInterval(() => {
      savedCallback.current?.()
    }, intervalMs)

    return () => clearInterval(id)
  }, [intervalMs, paused, alwaysPaused])
}
