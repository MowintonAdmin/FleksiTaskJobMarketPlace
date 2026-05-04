import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import api from '../api/client'

export const adminLogin = createAsyncThunk('auth/login', async ({ email, password }, { rejectWithValue }) => {
  try {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('admin_access_token', data.access_token)
    localStorage.setItem('admin_refresh_token', data.refresh_token)
    const me = await api.get('/users/me', { headers: { Authorization: `Bearer ${data.access_token}` } })
    if (!me.data.is_admin) throw new Error('Not an admin account')
    return { tokens: data, user: me.data }
  } catch (err) {
    return rejectWithValue(err.response?.data?.detail || err.message || 'Login failed')
  }
})

export const fetchAdminUser = createAsyncThunk('auth/fetchMe', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get('/users/me')
    return data
  } catch {
    return rejectWithValue('Session expired')
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
