import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * Pausable polling hook.
 * Calls `fetchFn` every `intervalMs` milliseconds (default 30000).
 * Automatically **pauses** while the user is interacting with the page
 * (typing, clicking, focusing inputs/buttons).
 * Resumes 3 seconds after the last interaction.
 *
 * @param {Function} fetchFn - The function to call on each tick.
 * @param {number} intervalMs - Polling interval in ms (default 30000).
 * @param {boolean} alwaysPaused - Optional external pause override.
 */
export default function usePausablePolling(fetchFn, intervalMs = 30000, alwaysPaused = false) {
  const savedCallback = useRef(fetchFn)
  const [paused, setPaused] = useState(false)
  const pauseTimer = useRef(null)
  const interactionTimer = useRef(null)

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

  const isPaused = paused || alwaysPaused

  useEffect(() => {
    if (isPaused || !savedCallback.current) return
    // Initial call
    savedCallback.current()
    const id = setInterval(() => savedCallback.current(), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs, isPaused])
}