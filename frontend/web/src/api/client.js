import axios from 'axios'

function normalizeApiHost(value) {
  if (!value) return ''
  const normalized = value.endsWith('/') ? value.slice(0, -1) : value
  return normalized.includes('yourdomain.com') ? '' : normalized
}

const configuredApiHost = normalizeApiHost(import.meta.env.VITE_API_BASE_URL?.trim())
const apiHost = configuredApiHost || (import.meta.env.DEV ? 'http://localhost:8000' : '')
const apiBaseUrl = `${apiHost}/api/v1`

const api = axios.create({
  baseURL: apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refreshToken = localStorage.getItem('refresh_token')
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${apiBaseUrl}/auth/refresh`, { refresh_token: refreshToken }, {
            headers: { 'Content-Type': 'application/json' },
          })
          localStorage.setItem('access_token', data.access_token)
          localStorage.setItem('refresh_token', data.refresh_token)
          original.headers.Authorization = `Bearer ${data.access_token}`
          return api(original)
        } catch {
          localStorage.removeItem('access_token')
          localStorage.removeItem('refresh_token')
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(error)
  }
)

export { apiBaseUrl }
export default api
