import axios from 'axios'
import { getPublicConfig } from '../config/runtime'
import { storage } from '../utils/storage'

function normalizeApiHost(value) {
  if (!value) return ''
  const normalized = value.endsWith('/') ? value.slice(0, -1) : value
  return normalized.includes('yourdomain.com') ? '' : normalized
}

const configuredApiHost = normalizeApiHost(getPublicConfig('VITE_API_BASE_URL', import.meta.env.VITE_API_BASE_URL?.trim()))
let apiHost = configuredApiHost
if (!apiHost) {
  if (import.meta.env.DEV) {
    apiHost = 'http://localhost:8000'
  } else {
    apiHost = typeof window !== 'undefined' ? window.location.origin : ''
    // Worker runs on port 3000, API on 8000
    if (apiHost && typeof window !== 'undefined' && window.location.port === '3000') {
      apiHost = 'http://localhost:8000'
    }
  }
}
const apiBaseUrl = `${apiHost}/api/v1`

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  const token = storage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Prevent concurrent refresh attempts: only one refresh runs at a time.
let _refreshPromise = null

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config

    // Requests with _skipRedirect:true (e.g. background polls) should not
    // trigger a hard redirect; just reject so the caller can handle it.
    if (error.response?.status === 401 && original._skipRedirect) {
      return Promise.reject(error)
    }

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refreshToken = storage.getItem('refresh_token')
      if (refreshToken) {
        try {
          // Coalesce concurrent refresh attempts into a single request.
          if (!_refreshPromise) {
            _refreshPromise = axios
              .post(`${apiBaseUrl}/auth/refresh`, { refresh_token: refreshToken }, {
                headers: { 'Content-Type': 'application/json' },
              })
              .finally(() => { _refreshPromise = null })
          }
          const { data } = await _refreshPromise
          storage.setItem('access_token', data.access_token)
          storage.setItem('refresh_token', data.refresh_token)
          original.headers.Authorization = `Bearer ${data.access_token}`
          return api(original)
        } catch {
          storage.removeItem('access_token')
          storage.removeItem('refresh_token')
          window.location.href = '/login'
        }
      }
      // No refresh token — reject without redirect so public requests are unaffected
    }
    return Promise.reject(error)
  }
)

export { apiBaseUrl, apiHost }
export default api
