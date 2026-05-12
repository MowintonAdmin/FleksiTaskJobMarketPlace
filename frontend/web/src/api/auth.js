import api from './client'

export const authApi = {
  googleAuth: async (idToken) => {
    const { data } = await api.post('/auth/google', { id_token: idToken })
    return data
  },
  register: async (payload) => {
    const { data } = await api.post('/auth/register', payload)
    return data
  },
  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    return data
  },
  logout: async () => {
    await api.post('/auth/logout')
  },
  forgotPassword: async (email) => {
    await api.post('/auth/forgot-password', { email })
  },
  resetPassword: async (token, new_password) => {
    await api.post('/auth/reset-password', { token, new_password })
  },
  getMe: async () => {
    const { data } = await api.get('/users/me')
    return data
  },
  updateMe: async (payload) => {
    const { data } = await api.put('/users/me', payload)
    return data
  },
  uploadPhoto: async (file) => {
    const form = new FormData()
    form.append('file', file)
    const { data } = await api.post('/users/me/photo', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },
}
