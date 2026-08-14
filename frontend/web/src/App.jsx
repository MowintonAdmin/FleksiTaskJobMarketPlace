import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, Link } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { fetchCurrentUser } from './store/authSlice'
import useNotifications from './hooks/useNotifications'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import ResetPassword from './pages/ResetPassword'
import Messages from './pages/Messages'
import Profile from './pages/Profile'
import TaskDetail from './pages/TaskDetail'
import MyApplications from './pages/MyApplications'
import TaskTracking from './pages/TaskTracking'
import Wallet from './pages/Wallet'
import History from './pages/History'
import Help from './pages/Help'

// Single toast behavior: always dismiss existing toasts when a new notification is triggered,
// maintaining at most ONE notification visible on screen at any time.
const wrapSingleToast = (fn) => (msg, opts) => {
  toast.dismiss()
  return fn(msg, opts)
}
toast.error = wrapSingleToast(toast.error)
toast.success = wrapSingleToast(toast.success)
toast.info = wrapSingleToast(toast.info)
toast.warn = wrapSingleToast(toast.warn)

/* ── Helper: check if a user profile has incomplete info ── */
export function isProfileIncomplete(user) {
  if (!user) return true
  // A profile is "incomplete" if the user hasn't filled in required fields
  const missing = []
  if (!user.phone) missing.push('phone')
  if (!user.full_name?.trim()) missing.push('full_name')
  if (!user.nric_passport) missing.push('nric_passport')
  if (!user.body_height_cm) missing.push('body_height_cm')
  if (missing.length >= 2) return true  // only flag if multiple fields missing (new user)
  return false  // has at least phone or NRIC filled — treat as complete enough
}

function PrivateRoute({ children }) {
  const token = useSelector((s) => s.auth.accessToken)
  return token ? children : <Navigate to="/login" replace />
}

function AppContent() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const token = useSelector((s) => s.auth.accessToken)
  const { user } = useSelector((s) => s.auth)
  const hasRedirected = useRef(false)
  const [bubbleDismissed, setBubbleDismissed] = useState(false)
  const [showFloatingStack, setShowFloatingStack] = useState(true)
  const lastScrollY = useRef(0)

  // Auto-hide floating stack when scrolling down, show when scrolling up
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      if (currentScrollY > lastScrollY.current + 15 && currentScrollY > 60) {
        setShowFloatingStack(false)
      } else if (currentScrollY < lastScrollY.current - 10) {
        setShowFloatingStack(true)
      }
      lastScrollY.current = currentScrollY
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (token) dispatch(fetchCurrentUser())
  }, [token, dispatch])

  // DevTools & F12 Protection Hook
  useEffect(() => {
    const handleContextMenu = (e) => {
      e.preventDefault()
    }

    const handleKeyDown = (e) => {
      // Intercept F12
      if (e.key === 'F12' || e.keyCode === 123) {
        e.preventDefault()
        e.stopPropagation()
        return false
      }
      // Intercept Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C, Ctrl+U, Ctrl+S
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.shiftKey
          ? ['I', 'i', 'J', 'j', 'C', 'c', 'K', 'k'].includes(e.key)
          : ['U', 'u', 'S', 's'].includes(e.key))
      ) {
        e.preventDefault()
        e.stopPropagation()
        return false
      }
    }

    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // Redirect to /profile ONLY IF profile incomplete AND hasn't been redirected yet in this session
  useEffect(() => {
    if (!token || !user) return
    if (hasRedirected.current) return

    // Only do this once per session
    const redirected = sessionStorage.getItem('profile_redirected')
    if (redirected) return

    const incomplete = isProfileIncomplete(user)
    if (incomplete) {
      hasRedirected.current = true
      sessionStorage.setItem('profile_redirected', 'true')
      navigate('/profile', { replace: true })
      toast.info('Welcome! Please complete your profile to start applying for tasks.', { autoClose: 6000 })
    }
  }, [user, token, navigate])

  useNotifications(user?.id, token)

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/tasks/:id" element={<TaskDetail />} />
          <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
          <Route path="/my-applications" element={<PrivateRoute><MyApplications /></PrivateRoute>} />
          <Route path="/messages" element={<PrivateRoute><Messages /></PrivateRoute>} />
          <Route path="/track/:applicationId" element={<PrivateRoute><TaskTracking /></PrivateRoute>} />
          <Route path="/wallet" element={<PrivateRoute><Wallet /></PrivateRoute>} />
          <Route path="/history" element={<PrivateRoute><History /></PrivateRoute>} />
          <Route path="/help" element={<Help />} />
        </Routes>
      </main>

      {/* Floating Action Buttons Stack (Bottom Right) - Non-blocking, Auto-hides on scroll */}
      <div
        className={`fixed bottom-4 right-4 sm:bottom-5 sm:right-5 z-40 flex flex-col items-end gap-2.5 transition-all duration-300 ${
          showFloatingStack ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0 pointer-events-none'
        }`}
      >
        {/* Help Center Button with Unverified Reminder */}
        <div className="relative flex items-center flex-row-reverse">
          <Link
            to="/help"
            className="w-11 h-11 sm:w-14 sm:h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 relative shrink-0"
            aria-label="Worker User Guide & Help Center"
            title="Worker User Guide & Help Center"
          >
            <span className="text-base sm:text-xl">❓</span>
            {!user?.is_verified && (
              <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500 border-2 border-white"></span>
              </span>
            )}
          </Link>

          {!user?.is_verified && !bubbleDismissed && (
            <div className="mr-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-3 py-1.5 rounded-xl shadow-lg text-[11px] sm:text-xs font-bold whitespace-nowrap animate-bounce flex items-center gap-1.5 hover:brightness-110 transition-all relative after:content-[''] after:absolute after:top-1/2 after:-right-2 after:-translate-y-1/2 after:border-6 after:border-transparent after:border-l-indigo-600">
              <Link to="/help" className="hover:underline flex items-center gap-1">
                <span>💬 Click me!</span>
              </Link>
              <button
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setBubbleDismissed(true)
                }}
                className="ml-1 text-white/80 hover:text-white font-black text-xs leading-none p-0.5"
                title="Dismiss reminder"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* WhatsApp Button */}
        <a
          href="https://wa.me/60108282060"
          target="_blank"
          rel="noopener noreferrer"
          className="w-11 h-11 sm:w-14 sm:h-14 bg-green-500 hover:bg-green-600 text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 shrink-0"
          aria-label="Chat on WhatsApp"
          title="Chat with us on WhatsApp"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 sm:w-7 sm:h-7">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </a>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <Router>
      <AppContent />
      <ToastContainer position="top-right" autoClose={5000} limit={1} />
    </Router>
  )
}