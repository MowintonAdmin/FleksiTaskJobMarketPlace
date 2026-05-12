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
    const { data } = await api.get('/messages/unread-count')
    return data.count
  },
}
