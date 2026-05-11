import { NavLink } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { logout } from '../slices/authSlice'

const links = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/users', label: 'Users', icon: '👥' },
  { to: '/tasks', label: 'Tasks', icon: '📋' },
  { to: '/applications', label: 'Applications', icon: '📝' },
  { to: '/active-workers', label: 'Active Workers', icon: '🟢' },
  { to: '/time-logs', label: 'Time & Payments', icon: '⏱️' },
  { to: '/withdrawals', label: 'Withdrawals', icon: '💸' },
  { to: '/analytics', label: 'Analytics', icon: '📈' },
]

export default function Sidebar({ open, onClose }) {
  const dispatch = useDispatch()

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
            <p className="font-bold text-lg">⚡ FleksiTask</p>
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
          {links.map(({ to, label, icon }) => (
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
              <span>{icon}</span> {label}
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
