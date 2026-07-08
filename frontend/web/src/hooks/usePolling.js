import { useEffect, useRef } from 'react'

/**
 * Safe polling hook — calls fetchFn every `intervalMs` milliseconds.
 * Cleans up automatically when component unmounts.
 * No backend changes needed, no new dependencies.
 */
export default function usePolling(fetchFn, intervalMs = 5000) {
  const savedCallback = useRef(fetchFn)

  useEffect(() => {
    savedCallback.current = fetchFn
  }, [fetchFn])

  useEffect(() => {
    const tick = () => savedCallback.current?.()
    tick() // immediate first call
    const id = setInterval(tick, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
}