import { useState, useEffect, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { loginWithGoogle, loginWithEmail } from '../store/authSlice'
import GoogleSignInButton from '../components/GoogleSignInButton'
import { getPublicConfig } from '../config/runtime'
import { authApi } from '../api/auth'

const REMEMBERED_EMAIL_KEY = 'remembered_email'

function hasGoogleClientId() {
  const clientId = getPublicConfig('VITE_GOOGLE_CLIENT_ID', import.meta.env.VITE_GOOGLE_CLIENT_ID).trim()
  return Boolean(clientId && !clientId.includes('your-google-client-id'))
}

/* ── Forgot Password Modal ────────────────────────────────────────────── */
function ForgotPasswordModal({ onClose }) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await authApi.forgotPassword(email.trim())
      setSent(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {sent ? (
          <div className="text-center">
            <p className="text-4xl mb-3">📬</p>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Check your inbox</h2>
            <p className="text-sm text-gray-500 mb-5">
              If an account exists for <strong>{email}</strong>, a password reset link has been sent.
            </p>
            <button onClick={onClose} className="btn-primary w-full">Done</button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Reset password</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">✕</button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Enter your email and we'll send you a link to reset your password.
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
                required
                autoFocus
                autoComplete="email"
              />
              {error && <p className="text-red-600 text-xs">{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

/* ── Login Page ───────────────────────────────────────────────────────── */
export default function Login() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { loading } = useSelector((s) => s.auth)

  const [email, setEmail] = useState(() => localStorage.getItem(REMEMBERED_EMAIL_KEY) || '')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(() => Boolean(localStorage.getItem(REMEMBERED_EMAIL_KEY)))
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState(null)
  const [showForgot, setShowForgot] = useState(false)

  const showGoogleSignIn = hasGoogleClientId()

  // Keep remembered email in sync with the checkbox
  useEffect(() => {
    if (rememberMe && email) {
      localStorage.setItem(REMEMBERED_EMAIL_KEY, email)
    } else if (!rememberMe) {
      localStorage.removeItem(REMEMBERED_EMAIL_KEY)
    }
  }, [rememberMe, email])

  const handleEmailLogin = async (e) => {
    e.preventDefault()
    setFormError(null)
    try {
      if (rememberMe) {
        localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim())
      } else {
        localStorage.removeItem(REMEMBERED_EMAIL_KEY)
      }
      await dispatch(loginWithEmail({ email: email.trim(), password })).unwrap()
      navigate('/')
    } catch (err) {
      setFormError(err || 'Login failed')
      toast.error(err || 'Login failed')
    }
  }

  const handleGoogleSignIn = useCallback(async (idToken) => {
    setFormError(null)
    try {
      await dispatch(loginWithGoogle(idToken)).unwrap()
      navigate('/')
    } catch (err) {
      const message = err || 'Google sign-in failed'
      setFormError(message)
      toast.error(message)
    }
  }, [dispatch, navigate])

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="card">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
            <p className="text-gray-500 text-sm mt-1">Sign in to find your next task</p>
          </div>

          {/* Google Sign-In */}
          {showGoogleSignIn && (
            <>
              <div className="mb-5">
                <GoogleSignInButton onCredential={handleGoogleSignIn} disabled={loading} />
              </div>
              <div className="relative mb-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase tracking-wide text-gray-400">
                  <span className="bg-white px-3">Or sign in with email</span>
                </div>
              </div>
            </>
          )}

          <form onSubmit={handleEmailLogin} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-gray-700">Password</label>
                <button
                  type="button"
                  onClick={() => setShowForgot(true)}
                  className="text-xs text-primary-600 hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pr-10"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
                  tabIndex={-1}
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-600">Remember me</span>
            </label>

            {formError && (
              <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs text-red-700">
                {formError}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-600 mt-5">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary-600 font-medium hover:underline">Sign Up</Link>
          </p>
        </div>
      </div>

      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
    </div>
  )
}
