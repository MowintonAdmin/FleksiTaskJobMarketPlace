import { useEffect, useRef } from 'react'
import { toast } from 'react-toastify'
import { messagesApi } from '../api/messages'
import api from '../api/client'

/**
 * Admin notification hook — runs on every admin page.
 * Polls every 5 seconds for changes and shows toast popups.
 *
 * Detects:
 *  - New unread messages (from workers)
 *  - New pending user verifications
 *  - New pending session approvals
 */
export default function useAdminNotifications(userId, accessToken) {
  const prevUnreadRef = useRef(0)
  const prevPendingVerificationsRef = useRef(0)
  const prevPendingSessionsRef = useRef(0)

  useEffect(() => {
    if (!accessToken || !userId) return

    let cancelled = false

    const check = async () => {
      try {
        // 1. Check for new messages
        const unreadCount = await messagesApi.getUnreadCount()
        if (!cancelled && unreadCount > prevUnreadRef.current) {
          const newMessages = unreadCount - prevUnreadRef.current
          toast.info(`📬 ${newMessages} new message${newMessages > 1 ? 's' : ''} from worker${newMessages > 1 ? 's' : ''}`, {
            autoClose: 5000,
          })
        }
        if (!cancelled) prevUnreadRef.current = unreadCount

        // 2. Check for new pending user verifications
        try {
          const { data: unverifiedUsers } = await api.get('/admin/users/unverified')
          const count = Array.isArray(unverifiedUsers) ? unverifiedUsers.length : 0
          if (!cancelled && count > prevPendingVerificationsRef.current) {
            const newCount = count - prevPendingVerificationsRef.current
            toast.warning(`🆕 ${newCount} new user${newCount > 1 ? 's' : ''} pending verification`, {
              autoClose: 6000,
            })
          }
          if (!cancelled) prevPendingVerificationsRef.current = count
        } catch {
          // silent
        }

        // 3. Check for new pending session approvals
        try {
          const { data: sessions } = await api.get('/admin/sessions/pending')
          const count = Array.isArray(sessions) ? sessions.length : 0
          if (!cancelled && count > prevPendingSessionsRef.current) {
            const newCount = count - prevPendingSessionsRef.current
            toast.info(`⏱ ${newCount} new session${newCount > 1 ? 's' : ''} awaiting approval`, {
              autoClose: 6000,
            })
          }
          if (!cancelled) prevPendingSessionsRef.current = count
        } catch {
          // silent
        }
      } catch {
        // silent
      }
    }

    // Initial check — set baseline without toasts
    const init = async () => {
      try {
        prevUnreadRef.current = await messagesApi.getUnreadCount()
      } catch {}

      try {
        const { data: unverifiedUsers } = await api.get('/admin/users/unverified')
        prevPendingVerificationsRef.current = Array.isArray(unverifiedUsers) ? unverifiedUsers.length : 0
      } catch {}

      try {
        const { data: sessions } = await api.get('/admin/sessions/pending')
        prevPendingSessionsRef.current = Array.isArray(sessions) ? sessions.length : 0
      } catch {}
    }

    init()

    const intervalId = setInterval(check, 5000)
    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [userId, accessToken])
}