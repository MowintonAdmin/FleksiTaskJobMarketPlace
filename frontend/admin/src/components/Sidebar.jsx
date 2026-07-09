import { useEffect, useState, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { messagesApi } from '../api/messages'
import api from '../api/client'
import { logout } from '../slices/authSlice'

const links = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/users', label: 'Workers', icon: '👥' },
  { to: '/user-verification', label: 'User Verification', icon: '🆕', badge: 'pendingVerif' },
  { to: '/admin-users', label: 'Admin Users', icon: '🛡️' },
  { to: '/tasks', label: 'Projects / Tasks', icon: '📋' },
  { to: '/applications', label: 'Applications', icon: '📝', badge: 'pendingApps' },
  { to: '/active-workers', label: 'Active Workers', icon: '🟢' },
  { to: '/session-approval', label: 'Session Approval', icon: '✅', badge: 'pendingSession' },
  { to: '/time-logs', label: 'Time & Payments', icon: '⏱️' },
  { to: '/withdrawals', label: 'Withdrawals', icon: '💸', badge: 'pendingWithdrawals' },
  { to: '/messages', label: 'Messages', icon: '💬', badge: 'unread' },
  { to: '/analytics', label: 'Analytics', icon: '📈' },
  { to: '/database', label: 'DB Backup', icon: '🗄️' },
]

function Badge({ count }) {
  if (!count) return null
  return (
    <span className="ml-auto min-w-[20px] h-5 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center font-bold px-1">
      {count > 99 ? '99+' : count}
    </span>
  )
}

export default function Sidebar({ open, onClose }) {
  const dispatch = useDispatch()
  const { token } = useSelector((s) => s.auth)
  const [unreadCount, setUnreadCount] = useState(0)
  const [pendingVerifCount, setPendingVerifCount] = useState(0)
  const [pendingSessionCount, setPendingSessionCount] = useState(0)
  const [pendingAppsCount, setPendingAppsCount] = useState(0)
  const [pendingWithdrawalsCount, setPendingWithdrawalsCount] = useState(0)
  const cancelledRef = useRef(false)

  useEffect(() => {
    if (!token) return
    cancelledRef.current = false

    const poll = async () => {
      try {
        const unread = await messagesApi.getUnreadCount()
        if (!cancelledRef.current) setUnreadCount(unread)
      } catch {}

      try {
        const { data } = await api.get('/admin/users/unverified')
        if (!cancelledRef.current) setPendingVerifCount(Array.isArray(data) ? data.length : 0)
      } catch {}

      try {
        const { data } = await api.get('/admin/sessions/pending-approval')
        if (!cancelledRef.current) setPendingSessionCount(Array.isArray(data) ? data.length : 0)
      } catch {}

      try {
        const { data } = await api.get('/admin/applications', { params: { status: 'pending' } })
        if (!cancelledRef.current) setPendingAppsCount(Array.isArray(data) ? data.length : 0)
      } catch {}

      try {
        const { data } = await api.get('/admin/withdrawals', { params: { status: 'PENDING' } })
        if (!cancelledRef.current) setPendingWithdrawalsCount(Array.isArray(data) ? data.length : 0)
      } catch {}
    }

    poll()
    const id = setInterval(poll, 5000)
    return () => { cancelledRef.current = true; clearInterval(id) }
  }, [token])

  const badgeCounts = {
    unread: unreadCount,
    pendingVerif: pendingVerifCount,
    pendingSession: pendingSessionCount,
    pendingApps: pendingAppsCount,
    pendingWithdrawals: pendingWithdrawalsCount,
  }

  const handleNav = () => {
    if (onClose) onClose()
  }

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={[
          'bg-gray-900 text-white flex flex-col shrink-0',
          'fixed inset-y-0 left-0 z-50 w-60 transition-transform duration-200',
          'md:static md:translate-x-0 md:z-auto md:transition-none',
          open ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <div className="px-6 py-5 border-b border-gray-700 flex items-center justify-between">
          <div>
            <p className="font-bold text-lg">⚡ FlekxiTask</p>
            <p className="text-xs text-gray-400 mt-0.5">Admin Dashboard</p>
          </div>
          {/* Close button — mobile only */}
          <button
            onClick={onClose}
            className="md:hidden p-1 rounded text-gray-400 hover:text-white"
            aria-label="Close sidebar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {links.map(({ to, label, icon, badge }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={handleNav}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'
                }`
              }
            >
              <span>{icon}</span>
              <span className="flex-1">{label}</span>
              {badge && <Badge count={badgeCounts[badge]} />}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-gray-700">
          <button
            onClick={() => { dispatch(logout()); handleNav() }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-300 hover:bg-gray-800 transition-colors"
          >
            <span>🚪</span> Logout
          </button>
        </div>
      </aside>
    </>
  )
}
