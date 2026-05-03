import { Link, useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { logoutUser } from '../store/authSlice'

export default function Navbar() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { user, accessToken } = useSelector((s) => s.auth)

  const handleLogout = async () => {
    await dispatch(logoutUser())
    navigate('/login')
  }

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl text-primary-600">
          <span className="text-2xl">⚡</span> FleksiTask
        </Link>

        <div className="flex items-center gap-3">
          {accessToken ? (
            <>
              <Link to="/wallet" className="text-sm text-gray-600 hover:text-primary-600 font-medium">
                💰 Wallet
              </Link>
              <Link to="/history" className="text-sm text-gray-600 hover:text-primary-600 font-medium">
                📊 History
              </Link>
              <Link to="/my-applications" className="text-sm text-gray-600 hover:text-primary-600 font-medium">
                My Applications
              </Link>
              <Link to="/profile">
                {user?.profile_photo_url ? (
                  <img src={user.profile_photo_url} alt="Profile" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full object-cover border-2 border-primary-500" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-sm">
                    {user?.full_name?.[0] ?? 'U'}
                  </div>
                )}
              </Link>
              <button onClick={handleLogout} className="btn-secondary text-xs px-3 py-1.5">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-secondary text-xs px-3 py-1.5">Login</Link>
              <Link to="/register" className="btn-primary text-xs px-3 py-1.5">Sign Up</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
