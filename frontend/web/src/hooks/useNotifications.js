import { useEffect, useRef } from 'react'
import { toast } from 'react-toastify'
import { messagesApi } from '../api/messages'
import { applicationsApi } from '../api/tasks'
import { authApi } from '../api/auth'
import { useDispatch } from 'react-redux'
import { setUser } from '../store/authSlice'

/**
 * Global notification hook — runs on every page for both user and admin.
 * Polls every 5 seconds for changes and shows toast popups when something new happens.
 *
 * Detects:
 *  - New unread messages (shows count)
 *  - Application status changes (approved/rejected)
 *  - New conversations
 *  - Verification status changes (approved/rejected by admin)
 */
export default function useNotifications(userId, accessToken) {
  const dispatch = useDispatch()

  // Keep track of previous state to detect changes
  const prevUnreadRef = useRef(0)
  const prevAppsRef = useRef('') // JSON stringified IDs+statuses for comparison
  const prevVerificationStatusRef = useRef(null)

  useEffect(() => {
    if (!accessToken || !userId) return

    let cancelled = false

    const check = async () => {
      try {
        // 1. Check for new messages
        const unreadCount = await messagesApi.getUnreadCount()
        if (!cancelled && unreadCount > prevUnreadRef.current) {
          const newMessages = unreadCount - prevUnreadRef.current
          toast.info(`📬 ${newMessages} new message${newMessages > 1 ? 's' : ''}`, {
            autoClose: 5000,
            toastId: `msg-${Date.now()}`, // prevents duplicate toasts
          })
        }
        if (!cancelled) prevUnreadRef.current = unreadCount

        // 2. Check for application status changes (worker only)
        try {
          const apps = await applicationsApi.getMyApplications()
          if (!cancelled) {
            const currentKey = apps.map(a => `${a.id}-${a.status}`).join('|')
            const prevKey = prevAppsRef.current

            if (prevKey && currentKey !== prevKey) {
              // Find what changed
              const prevMap = new Map(prevKey.split('|').map(s => {
                const [id, status] = s.split('-')
                return [id, status]
              }))

              for (const app of apps) {
                const prevStatus = prevMap.get(app.id)
                if (prevStatus && prevStatus !== app.status) {
                  const taskTitle = app.task?.title || 'A task'
                  if (app.status === 'approved') {
                    toast.success(`✅ Application for "${taskTitle}" was approved!`, { autoClose: 6000 })
                  } else if (app.status === 'rejected') {
                    toast.error(`❌ Application for "${taskTitle}" was rejected`, { autoClose: 6000 })
                  }
                }
              }
            }
            prevAppsRef.current = currentKey
          }
        } catch {
          // Not logged in or not a worker — skip
        }

        // 3. Check for verification status changes
        try {
          const updated = await authApi.getMe()
          if (!cancelled && updated) {
            const currentStatus = updated.verification_status || (updated.is_verified ? 'approved' : 'pending')
            const prevStatus = prevVerificationStatusRef.current

            if (prevStatus && prevStatus !== currentStatus) {
              if (currentStatus === 'approved') {
                toast.success(`✅ Your account has been verified! You can now apply for tasks.`, {
                  autoClose: 8000,
                  toastId: 'verification-approved',
                })
              } else if (currentStatus === 'rejected') {
                const reason = updated.rejection_reason || 'No specific reason provided'
                toast.error(`❌ Your verification was rejected. Reason: ${reason}`, {
                  autoClose: 10000,
                  toastId: 'verification-rejected',
                })
              }

              // Update Redux store with latest user data so profile reflects change
              if (dispatch) {
                dispatch(setUser(updated))
              }
            }
            prevVerificationStatusRef.current = currentStatus
          }
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
        const unreadCount = await messagesApi.getUnreadCount()
        if (!cancelled) prevUnreadRef.current = unreadCount

        try {
          const apps = await applicationsApi.getMyApplications()
          if (!cancelled) {
            prevAppsRef.current = apps.map(a => `${a.id}-${a.status}`).join('|')
          }
        } catch {}

        try {
          const updated = await authApi.getMe()
          if (!cancelled && updated) {
            prevVerificationStatusRef.current = updated.verification_status || (updated.is_verified ? 'approved' : 'pending')
          }
        } catch {}
      } catch {}
    }

    init()

    const intervalId = setInterval(check, 5000)
    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [userId, accessToken, dispatch])
}