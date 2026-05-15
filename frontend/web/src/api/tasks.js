import api from './client'

export const tasksApi = {
  list: async ({ page = 1, pageSize = 20, location, category, minPay, maxPay } = {}) => {
    const params = new URLSearchParams({ page, page_size: pageSize })
    if (location) params.set('location', location)
    if (category) params.set('category', category)
    if (minPay) params.set('min_pay', minPay)
    if (maxPay) params.set('max_pay', maxPay)
    const { data } = await api.get(`/tasks?${params}`)
    return data
  },
  getById: async (id) => {
    const { data } = await api.get(`/tasks/${id}`)
    return data
  },
  create: async (payload) => {
    const { data } = await api.post('/tasks', payload)
    return data
  },
}

export const applicationsApi = {
  apply: async (taskId, coverNote) => {
    const { data } = await api.post('/applications', { task_id: taskId, cover_note: coverNote })
    return data
  },
  getMyApplications: async () => {
    const { data } = await api.get('/applications/my')
    return data
  },
  getTaskApplications: async (taskId) => {
    const { data } = await api.get(`/applications/task/${taskId}`)
    return data
  },
  updateStatus: async (applicationId, status) => {
    const { data } = await api.patch(`/applications/${applicationId}/status`, { status })
    return data
  },
}

export const taskSessionsApi = {
  checkIn: async (applicationId) => {
    const { data } = await api.post('/task-sessions/checkin', { application_id: applicationId })
    return data
  },
  checkOut: async (sessionId, proofNotes, proofPhoto) => {
    if (!proofPhoto) {
      const { data } = await api.post(`/task-sessions/${sessionId}/checkout-simple`, {
        proof_notes: proofNotes || null,
      })
      return data
    }

    const form = new FormData()
    if (proofNotes) form.append('proof_notes', proofNotes)
    form.append('proof_photo', proofPhoto)
    const { data } = await api.post(`/task-sessions/${sessionId}/checkout`, form)
    return data
  },
  getEarnings: async (sessionId) => {
    const { data } = await api.get(`/task-sessions/${sessionId}/earnings`)
    return data
  },
  getMySessions: async () => {
    const { data } = await api.get('/task-sessions/my')
    return data
  },
  getActiveSession: async () => {
    const { data } = await api.get('/task-sessions/active')
    return data
  },
  pause: async (sessionId) => {
    const { data } = await api.post(`/task-sessions/${sessionId}/pause`)
    return data
  },
}
