import axios from 'axios'
import { storage } from '../utils/storage'

function normalizeApiHost(value) {
  if (!value) return ''
  const normalized = value.endsWith('/') ? value.slice(0, -1) : value
  return normalized.includes('yourdomain.com') ? '' : normalized
}

function getRuntimeApiHost() {
  if (typeof window === 'undefined' || import.meta.env.DEV) return ''

  const { protocol, hostname, origin } = window.location

  if (hostname.startsWith('api.')) {
    return origin
  }

  if (hostname.startsWith('admin.')) {
    return `${protocol}//api.${hostname.slice('admin.'.length)}`
  }

  if (hostname.startsWith('www.')) {
    return `${protocol}//api.${hostname.slice('www.'.length)}`
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname === 'localhost') {
    return origin
  }

  return hostname.includes('.') ? `${protocol}//api.${hostname}` : origin
}

const configuredApiHost = normalizeApiHost(import.meta.env.VITE_API_BASE_URL?.trim())
let apiHost = configuredApiHost
if (!apiHost) {
  apiHost = getRuntimeApiHost()
  // Dev fallback: when running locally on port 3001, API is on 8000
  if (apiHost && !configuredApiHost && window.location.port === '3001') {
    apiHost = 'http://localhost:8000'
  }
}
const apiBaseUrl = `${apiHost}/api/v1`

const api = axios.create({ baseURL: apiBaseUrl })

api.interceptors.request.use((config) => {
  const token = storage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const rt = storage.getItem('refresh_token')
      if (rt) {
        try {
          const { data } = await axios.post(`${apiBaseUrl}/auth/refresh`, { refresh_token: rt })
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
    }
    return Promise.reject(error)
  }
)

export { apiBaseUrl }
export default api
