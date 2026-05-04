import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../api/client'

function extractErrorMessage(err, fallbackMessage) {
  const detail = err.response?.data?.detail
  if (Array.isArray(detail)) {
    return detail.map((entry) => entry.msg).join(', ')
  }

  if (typeof detail === 'string' && detail.trim()) {
    return detail
  }

  const contentType = err.response?.headers?.['content-type'] || ''
  if (err.response?.status === 404 && contentType.includes('text/html')) {
    return 'API route not reachable. Check VITE_API_BASE_URL and the admin-to-API domain routing.'
  }

  if (err.code === 'ERR_NETWORK') {
    return 'Cannot reach the API. Check the backend domain, ALLOWED_ORIGINS, and VITE_API_BASE_URL.'
  }

  if (typeof err.response?.data === 'string' && err.response.data.includes('Not Found')) {
    return 'API route not reachable. Check VITE_API_BASE_URL and the admin-to-API domain routing.'
  }

  return fallbackMessage
}

export const adminLogin = createAsyncThunk('auth/login', async ({ email, password }, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('admin_access_token', data.access_token)
    localStorage.setItem('admin_refresh_token', data.refresh_token)
    const me = await api.get('/users/me', { headers: { Authorization: `Bearer ${data.access_token}` } })
    if (!me.data.is_admin) throw new Error('Not an admin account')
    return { tokens: data, user: me.data }
  } catch (err) {
    return rejectWithValue(extractErrorMessage(err, err.message || 'Login failed'))
  }
})

export const fetchAdminUser = createAsyncThunk('auth/fetchMe', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/users/me')
    return data
  } catch (err) {
    return rejectWithValue(extractErrorMessage(err, 'Session expired'))
  }
})

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    token: localStorage.getItem('admin_access_token'),
    loading: false,
    error: null,
  },
  reducers: {
    logout: (state) => {
      state.user = null
      state.token = null
      localStorage.removeItem('admin_access_token')
      localStorage.removeItem('admin_refresh_token')
    },
  },
  extraReducers: (b) => {
    b.addCase(adminLogin.pending, (s) => { s.loading = true; s.error = null })
     .addCase(adminLogin.fulfilled, (s, a) => { s.loading = false; s.token = a.payload.tokens.access_token; s.user = a.payload.user })
     .addCase(adminLogin.rejected, (s, a) => { s.loading = false; s.error = a.payload })
     .addCase(fetchAdminUser.fulfilled, (s, a) => { s.user = a.payload })
     .addCase(fetchAdminUser.rejected, (s) => { s.user = null; s.token = null })
  },
})

export const { logout } = authSlice.actions
export default authSlice.reducer
