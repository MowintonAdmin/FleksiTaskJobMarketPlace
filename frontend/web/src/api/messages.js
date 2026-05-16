import api from './client'

export const messagesApi = {
  getConversations: async () => {
    const { data } = await api.get('/messages/conversations')
    return data
  },
  getConversation: async (userId) => {
    const { data } = await api.get(`/messages/conversation/${userId}`)
    return data
  },
  sendMessage: async (recipientId, body) => {
    const { data } = await api.post('/messages', { recipient_id: recipientId, body })
    return data
  },
  getUnreadCount: async () => {
    // _skipRedirect prevents the global 401 interceptor from doing a hard
    // redirect to /login when this background poll fires with expired tokens.
    const { data } = await api.get('/messages/unread-count', { _skipRedirect: true })
    return data.count
  },
  getAdmins: async () => {
    const { data } = await api.get('/users/admins')
    return data
  },
}
