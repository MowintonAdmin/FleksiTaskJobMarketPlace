import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { logoutUser } from '../store/authSlice'

export default function Navbar() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, accessToken } = useSelector((s) => s.auth)
  const [menuOpen, setMenuOpen] = useState(false)

  const close = () => setMenuOpen(false)

  const handleLogout = async () => {
    close()
    await dispatch(logoutUser())
    navigate('/login')
  }

  const avatar = user?.profile_photo_url ? (
    <img src={user.profile_photo_url} alt="Profile" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full object-cover border-2 border-primary-500" />
  ) : (
    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-sm">
      {user?.full_name?.[0] ?? 'U'}
    </div>
  )

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" onClick={close} className="flex items-center gap-2 font-bold text-xl text-primary-600">
          <span className="text-2xl">⚡</span> FleksiTask
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-3">
          {accessToken ? (
            <>
              <Link to="/wallet" className="text-sm text-gray-600 hover:text-primary-600 font-medium">💰 Wallet</Link>
              <Link to="/history" className="text-sm text-gray-600 hover:text-primary-600 font-medium">📊 History</Link>
              <Link to="/my-applications" className="text-sm text-gray-600 hover:text-primary-600 font-medium">My Applications</Link>
              <Link to="/profile">{avatar}</Link>
              <button onClick={handleLogout} className="btn-secondary text-xs px-3 py-1.5">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-secondary text-xs px-3 py-1.5">Login</Link>
              <Link to="/register" className="btn-primary text-xs px-3 py-1.5">Sign Up</Link>
            </>
          )}
        </div>

        {/* Mobile: profile avatar (logged-in) + hamburger */}
        <div className="flex md:hidden items-center gap-3">
          {accessToken && (
            <Link to="/profile" onClick={close}>{avatar}</Link>
          )}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          >
            {menuOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu drawer */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white shadow-lg">
          <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-1">
            {accessToken ? (
              <>
                {user?.full_name && (
                  <p className="text-xs text-gray-400 font-medium px-3 pt-1 pb-2 border-b border-gray-100 mb-1">
                    {user.full_name}
                  </p>
                )}
                <Link to="/wallet" onClick={close} className="flex items-center gap-3 px-3 py-3 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium">
                  <span>💰</span> Wallet
                </Link>
                <Link to="/history" onClick={close} className="flex items-center gap-3 px-3 py-3 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium">
                  <span>📊</span> History
                </Link>
                <Link to="/my-applications" onClick={close} className="flex items-center gap-3 px-3 py-3 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium">
                  <span>📋</span> My Applications
                </Link>
                <Link to="/profile" onClick={close} className="flex items-center gap-3 px-3 py-3 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium">
                  <span>👤</span> Profile
                </Link>
                <div className="border-t border-gray-100 mt-1 pt-2">
                  <button onClick={handleLogout} className="w-full text-left flex items-center gap-3 px-3 py-3 rounded-lg text-red-600 hover:bg-red-50 text-sm font-medium">
                    <span>🚪</span> Logout
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link to="/login" onClick={close} className="flex items-center gap-3 px-3 py-3 rounded-lg text-gray-700 hover:bg-gray-50 text-sm font-medium">
                  Login
                </Link>
                <Link to="/register" onClick={close} className="flex items-center gap-3 px-3 py-3 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700">
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
