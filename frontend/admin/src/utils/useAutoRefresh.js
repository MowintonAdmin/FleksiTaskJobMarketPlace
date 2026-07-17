import { useEffect, useRef } from 'react'

/**
 * useAutoRefresh(callback, intervalMs)
 * Calls `callback` every `intervalMs` milliseconds.
 * Default interval is 30 seconds (30000ms).
 * Cleans up on unmount.
 */
export function useAutoRefresh(callback, intervalMs = 30000) {
  const savedCallback = useRef(callback)

  useEffect(() => {
    savedCallback.current = callback
  }, [callback])

  useEffect(() => {
    if (!savedCallback.current) return
    const id = setInterval(() => savedCallback.current(), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
}