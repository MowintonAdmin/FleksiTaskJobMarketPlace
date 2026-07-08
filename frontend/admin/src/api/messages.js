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
    const { data } = await api.get('/messages/unread-count', { _skipRedirect: true })
    return data.count
  },
  deleteMessage: async (messageId) => {
    await api.delete(`/messages/${messageId}`)
  },
  getReadStatuses: async (userId) => {
    const { data } = await api.get(`/messages/conversation/${userId}/read-statuses`, { _skipRedirect: true })
    return data
  },
  getWorkers: async () => {
    const { data } = await api.get('/users', { params: { limit: 200 } })
    return data
  },
  getQuickReplies: async () => {
    const { data } = await api.get('/messages/quick-replies')
    return data
  },
  reactToMessage: async (messageId, reaction) => {
    const { data } = await api.post(`/messages/reaction/${messageId}`, { reaction })
    return data
  },
  sendTyping: async (userId) => {
    await api.post(`/messages/typing/${userId}`)
  },
  checkTyping: async (userId) => {
    const { data } = await api.get(`/messages/typing/${userId}`, { _skipRedirect: true })
    return data
  },
}
