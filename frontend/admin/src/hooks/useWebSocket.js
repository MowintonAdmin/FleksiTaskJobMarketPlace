import { useEffect, useRef, useCallback } from 'react'
import { storage } from '../utils/storage'

/**
 * Reusable WebSocket hook for real-time admin updates.
 * Maintains a single connection, auto-reconnects with exponential backoff,
 * and dispatches events via a callback.
 *
 * @param {Object} options
 * @param {Function} options.onEvent - Callback fired on each incoming event: onEvent(eventType, data)
 * @param {number} options.reconnectBaseMs - Base delay for exponential backoff (default 1000)
 * @param {number} options.maxReconnectMs - Maximum reconnect delay (default 30000)
 * @param {number} options.pingIntervalMs - How often to send a ping (default 25000)
 * @returns {{ isConnected: boolean, wsRef: React.MutableRefObject }}
 */
export default function useWebSocket({ onEvent, reconnectBaseMs = 1000, maxReconnectMs = 30000, pingIntervalMs = 25000 }) {
  const wsRef = useRef(null)
  const reconnectAttempt = useRef(0)
  const reconnectTimer = useRef(null)
  const pingTimer = useRef(null)
  const isConnectedRef = useRef(false)
  const onEventRef = useRef(onEvent)
  const mountedRef = useRef(true)

  // Keep callback reference fresh
  useEffect(() => {
    onEventRef.current = onEvent
  }, [onEvent])

  const connect = useCallback(() => {
    if (!mountedRef.current) return

    const token = storage.getItem('access_token')
    if (!token) return

    // Build WebSocket URL based on current location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    // In dev mode, admin runs on :3001 but API is on :8000
    let wsUrl
    if (import.meta.env.DEV) {
      wsUrl = `ws://localhost:8000/api/v1/ws/admin?token=${token}`
    } else {
      wsUrl = `${protocol}//${host}/api/v1/ws/admin?token=${token}`
    }

    try {
      const ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        isConnectedRef.current = true
        reconnectAttempt.current = 0
        if (onEventRef.current) onEventRef.current('__CONNECTED__', null)
        // Start ping interval
        clearInterval(pingTimer.current)
        pingTimer.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'PING' }))
          }
        }, pingIntervalMs)
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'PONG') return
          if (onEventRef.current) {
            onEventRef.current(msg.type, msg.data || {})
          }
        } catch { /* ignore malformed messages */ }
      }

      ws.onclose = () => {
        isConnectedRef.current = false
        clearInterval(pingTimer.current)
        if (onEventRef.current) onEventRef.current('__DISCONNECTED__', null)
        // Schedule reconnect with exponential backoff
        if (mountedRef.current) {
          const delay = Math.min(
            reconnectBaseMs * Math.pow(2, reconnectAttempt.current),
            maxReconnectMs
          )
          reconnectAttempt.current++
          clearTimeout(reconnectTimer.current)
          reconnectTimer.current = setTimeout(connect, delay + Math.random() * 1000)
        }
      }

      ws.onerror = () => {
        // onclose will fire after this
        ws.close()
      }

      wsRef.current = ws
    } catch {
      // Connection failed, retry
      if (mountedRef.current) {
        const delay = Math.min(
          reconnectBaseMs * Math.pow(2, reconnectAttempt.current),
          maxReconnectMs
        )
        reconnectAttempt.current++
        clearTimeout(reconnectTimer.current)
        reconnectTimer.current = setTimeout(connect, delay + Math.random() * 1000)
      }
    }
  }, [reconnectBaseMs, maxReconnectMs, pingIntervalMs])

  useEffect(() => {
    mountedRef.current = true
    connect()
    return () => {
      mountedRef.current = false
      clearTimeout(reconnectTimer.current)
      clearInterval(pingTimer.current)
      if (wsRef.current) {
        wsRef.current.onclose = null // prevent reconnect on unmount
        wsRef.current.close()
      }
    }
  }, [connect])

  return { wsRef, isConnectedRef }
}