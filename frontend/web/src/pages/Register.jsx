import { useCallback, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import GoogleSignInButton from '../components/GoogleSignInButton'
import { getPublicConfig } from '../config/runtime'
import { loginWithGoogle } from '../store/authSlice'
import { authApi } from '../api/auth'

function hasGoogleClientId() {
  const clientId = getPublicConfig('VITE_GOOGLE_CLIENT_ID', import.meta.env.VITE_GOOGLE_CLIENT_ID).trim()
  return Boolean(clientId && !clientId.includes('your-google-client-id'))
}

export default function Register() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { loading } = useSelector((s) => s.auth)
  const showGoogleSignIn = hasGoogleClientId()

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
    location: '',
  })
  const [formError, setFormError] = useState(null)
  const [showPassword, setShowPassword] = useState(false)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleGoogleSignIn = useCallback(async (idToken) => {
    setFormError(null)
    try {
      await dispatch(loginWithGoogle(idToken)).unwrap()
      toast.success('Signed in with Google. Welcome to FlekxiTask.')
      navigate('/')
    } catch (err) {
      const message = err || 'Google sign-in failed'
      setFormError(message)
      toast.error(message)
    }
  }, [dispatch, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError(null)

    if (form.password !== form.confirm_password) {
      setFormError('Passwords do not match')
      return
    }
    if (form.password.length < 8) {
      setFormError('Password must be at least 8 characters')
      return
    }

    try {
      await authApi.register({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
        location: form.location.trim() || undefined,
      })
      toast.success('Account created! Welcome to FlekxiTask. You can now sign in and start applying for tasks.')
      navigate('/login')
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Registration failed'
      setFormError(msg)
      toast.error(msg)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="card">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
            <p className="text-gray-500 text-sm mt-1">Start finding flexible work today</p>
          </div>

          {showGoogleSignIn && (
            <>
              <div className="space-y-3 mb-5">
                <GoogleSignInButton onCredential={handleGoogleSignIn} disabled={loading} />
                <p className="text-xs text-center text-gray-500">Create your account instantly with Google, or use email below.</p>
              </div>

              <div className="relative mb-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase tracking-wide text-gray-400">
                  <span className="bg-white px-3">Or register with email</span>
                </div>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => set('full_name', e.target.value)}
                className="input"
                placeholder="Ahmad bin Ali"
                required
                autoComplete="name"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                className="input"
                placeholder="you@example.com"
                required
                autoComplete="email"
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Location <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => set('location', e.target.value)}
                className="input"
                placeholder="Kuala Lumpur"
                autoComplete="address-level2"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  className="input pr-10"
                  placeholder="Min. 8 characters"
                  required
                  autoComplete="new-password"
                  minLength={8}
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

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.confirm_password}
                onChange={(e) => set('confirm_password', e.target.value)}
                className={`input ${form.confirm_password && form.confirm_password !== form.password ? 'border-red-400 focus:ring-red-300' : ''}`}
                placeholder="Re-enter your password"
                required
                autoComplete="new-password"
              />
              {form.confirm_password && form.confirm_password !== form.password && (
                <p className="text-red-500 text-xs mt-1">Passwords do not match</p>
              )}
            </div>

            {formError && (
              <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-xs text-red-700">
                {formError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (form.confirm_password && form.confirm_password !== form.password)}
              className="btn-primary w-full mt-2"
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <div className="mt-4 space-y-2 text-xs text-gray-500">
            {['Browse hundreds of local tasks', 'One-tap application', 'Real-time earnings tracking'].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <span className="text-green-500">✓</span> {item}
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-gray-600 mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 font-medium hover:underline">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  )
}