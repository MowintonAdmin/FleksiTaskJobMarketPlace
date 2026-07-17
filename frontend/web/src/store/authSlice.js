import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { authApi } from '../api/auth'
import { storage } from '../utils/storage'

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
    return 'API route not reachable. Check that the backend is running and VITE_API_BASE_URL points to it.'
  }

  if (err.code === 'ERR_NETWORK') {
    return 'Cannot reach the API. Check the backend domain, ALLOWED_ORIGINS, and VITE_API_BASE_URL.'
  }

  if (typeof err.response?.data === 'string' && err.response.data.includes('Not Found')) {
    return 'API route not reachable. Check that the backend is running and VITE_API_BASE_URL points to it.'
  }

  return fallbackMessage
}

export const loginWithGoogle = createAsyncThunk('auth/loginWithGoogle', async (idToken, { rejectWithValue }) => {
  try {
    const data = await authApi.googleAuth(idToken)
    storage.setItem('access_token', data.access_token)
    storage.setItem('refresh_token', data.refresh_token)
    return data
  } catch (err) {
    return rejectWithValue(extractErrorMessage(err, 'Google login failed'))
  }
})

export const registerUser = createAsyncThunk('auth/register', async (payload, { rejectWithValue }) => {
  try {
    const data = await authApi.register(payload)
    storage.setItem('access_token', data.access_token)
    storage.setItem('refresh_token', data.refresh_token)
    return data
  } catch (err) {
    return rejectWithValue(extractErrorMessage(err, 'Registration failed'))
  }
})

export const loginWithEmail = createAsyncThunk('auth/loginWithEmail', async ({ email, password }, { rejectWithValue }) => {
  try {
    const data = await authApi.login(email, password)
    storage.setItem('access_token', data.access_token)
    storage.setItem('refresh_token', data.refresh_token)
    return data
  } catch (err) {
    return rejectWithValue(extractErrorMessage(err, 'Login failed'))
  }
})

export const fetchCurrentUser = createAsyncThunk('auth/fetchCurrentUser', async (_, { rejectWithValue }) => {
  try {
    return await authApi.getMe()
  } catch (err) {
    return rejectWithValue(extractErrorMessage(err, 'Failed to fetch user'))
  }
})

export const logoutUser = createAsyncThunk('auth/logout', async () => {
  await authApi.logout()
  storage.removeItem('access_token')
  storage.removeItem('refresh_token')
})

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    accessToken: storage.getItem('access_token'),
    loading: false,
    error: null,
  },
  reducers: {
    clearError: (state) => { state.error = null },
    setUser: (state, action) => { state.user = action.payload },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginWithGoogle.pending, (state) => { state.loading = true; state.error = null })
      .addCase(loginWithGoogle.fulfilled, (state, action) => {
        state.loading = false
        state.accessToken = action.payload.access_token
      })
      .addCase(loginWithGoogle.rejected, (state, action) => { state.loading = false; state.error = action.payload })
      .addCase(loginWithEmail.pending, (state) => { state.loading = true; state.error = null })
      .addCase(loginWithEmail.fulfilled, (state, action) => {
        state.loading = false
        state.accessToken = action.payload.access_token
      })
      .addCase(loginWithEmail.rejected, (state, action) => { state.loading = false; state.error = action.payload })
      .addCase(registerUser.pending, (state) => { state.loading = true; state.error = null })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.loading = false
        state.accessToken = action.payload.access_token
      })
      .addCase(registerUser.rejected, (state, action) => { state.loading = false; state.error = action.payload })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => { state.user = action.payload })
      .addCase(fetchCurrentUser.rejected, (state) => { state.user = null; state.accessToken = null })
      .addCase(logoutUser.fulfilled, (state) => { state.user = null; state.accessToken = null })
  },
})

export const { clearError, setUser } = authSlice.actions
export default authSlice.reducer