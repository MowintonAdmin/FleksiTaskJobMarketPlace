import { useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { messagesApi } from '../api/messages'

/* ── Helpers ──────────────────────────────────────────────────────────── */
function Avatar({ name, photo, size = 'md' }) {
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'
  if (photo) {
    return <img src={photo} alt={name} referrerPolicy="no-referrer" className={`${sz} rounded-full object-cover shrink-0`} />
  }
  return (
    <div className={`${sz} rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold shrink-0`}>
      {(name || '?')[0].toUpperCase()}
    </div>
  )
}

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now - d) / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

/* ── Conversation list (left panel) ──────────────────────────────────── */
function ConversationList({ conversations, activeId, onSelect, loading }) {
  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="w-10 h-10 rounded-full bg-gray-200 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 bg-gray-200 rounded w-1/2" />
              <div className="h-3 bg-gray-100 rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center px-6">
        <p className="text-3xl mb-2">💬</p>
        <p className="text-sm font-medium text-gray-600">No messages yet</p>
        <p className="text-xs text-gray-400 mt-1">When someone messages you, it'll appear here.</p>
      </div>
    )
  }

  return (
    <ul>
      {conversations.map((c) => (
        <li key={c.user_id}>
          <button
            onClick={() => onSelect(c)}
            className={[
              'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
              c.user_id === activeId
                ? 'bg-primary-50 border-l-2 border-primary-500'
                : 'hover:bg-gray-50 border-l-2 border-transparent',
            ].join(' ')}
          >
            <div className="relative">
              <Avatar name={c.user_name} photo={c.user_photo} />
              {c.unread_count > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary-600 rounded-full text-white text-[10px] flex items-center justify-center font-bold">
                  {c.unread_count > 9 ? '9+' : c.unread_count}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className={`text-sm truncate ${c.unread_count > 0 ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                  {c.user_name || 'Unknown'}
                </p>
                <p className="text-xs text-gray-400 shrink-0">{formatTime(c.last_message_at)}</p>
              </div>
              <p className={`text-xs truncate mt-0.5 ${c.unread_count > 0 ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
                {c.last_message}
              </p>
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}

/* ── Chat panel (right) ───────────────────────────────────────────────── */
function ChatPanel({ conversation, currentUserId, onBack, onNewMessage }) {
  const [messages, setMessages] = useState([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  const load = useCallback(async () => {
    if (!conversation) return
    setLoading(true)
    try {
      const msgs = await messagesApi.getConversation(conversation.user_id)
      setMessages(msgs)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [conversation])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!body.trim() || sending) return
    setSending(true)
    try {
      const msg = await messagesApi.sendMessage(conversation.user_id, body.trim())
      setMessages((prev) => [...prev, msg])
      setBody('')
      onNewMessage?.()
    } catch {
      // silent
    } finally {
      setSending(false)
    }
  }

  if (!conversation) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <p className="text-5xl mb-3">💬</p>
        <p className="font-semibold text-gray-700">Select a conversation</p>
        <p className="text-sm text-gray-400 mt-1">Choose a conversation from the list to start messaging.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white shrink-0">
        <button onClick={onBack} className="md:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 mr-1" aria-label="Back">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <Avatar name={conversation.user_name} photo={conversation.user_photo} />
        <div>
          <p className="font-semibold text-gray-900 text-sm">{conversation.user_name || 'Unknown'}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {loading ? (
          <div className="flex justify-center items-center h-24">
            <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-gray-400 mt-8">No messages yet. Say hello! 👋</p>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_id === currentUserId
            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm shadow-sm ${
                  isMine
                    ? 'bg-primary-600 text-white rounded-br-sm'
                    : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                }`}>
                  <p className="break-words">{msg.body}</p>
                  <p className={`text-[10px] mt-1 ${isMine ? 'text-primary-200 text-right' : 'text-gray-400'}`}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {isMine && (
                      <span className="ml-1">{msg.is_read ? '✓✓' : '✓'}</span>
                    )}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 bg-white shrink-0">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend(e)}
          placeholder="Type a message…"
          className="flex-1 px-4 py-2.5 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 bg-gray-50"
          disabled={sending}
        />
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="w-10 h-10 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white rounded-full flex items-center justify-center shrink-0 transition-colors"
          aria-label="Send"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-7 7m7-7l7 7" />
          </svg>
        </button>
      </form>
    </div>
  )
}

/* ── Page ─────────────────────────────────────────────────────────────── */
export default function Messages() {
  const { user } = useSelector((s) => s.auth)
  const [searchParams, setSearchParams] = useSearchParams()
  const [conversations, setConversations] = useState([])
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [activeConv, setActiveConv] = useState(null)
  // On mobile, show the chat panel when a conversation is selected
  const [mobileShowChat, setMobileShowChat] = useState(false)

  const loadConversations = useCallback(async () => {
    try {
      const convs = await messagesApi.getConversations()
      setConversations(convs)
      // Auto-select from URL param ?with=<userId>
      const withId = searchParams.get('with')
      if (withId) {
        const found = convs.find((c) => c.user_id === withId)
        if (found) {
          setActiveConv(found)
          setMobileShowChat(true)
        }
      }
    } catch {
      // silent
    } finally {
      setLoadingConvs(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadConversations() }, [loadConversations])

  const handleSelect = (conv) => {
    setActiveConv(conv)
    setMobileShowChat(true)
    setSearchParams({ with: conv.user_id })
    // Clear unread locally
    setConversations((prev) =>
      prev.map((c) => (c.user_id === conv.user_id ? { ...c, unread_count: 0 } : c))
    )
  }

  const handleBack = () => {
    setMobileShowChat(false)
  }

  const handleNewMessage = () => {
    // Refresh conversation list so last_message updates
    messagesApi.getConversations().then(setConversations).catch(() => {})
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900 mb-4">Messages</h1>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden" style={{ height: 'calc(100vh - 14rem)', minHeight: 480 }}>
        <div className="flex h-full">
          {/* Left: conversation list */}
          <div className={[
            'w-full md:w-72 lg:w-80 border-r border-gray-100 flex flex-col shrink-0',
            mobileShowChat ? 'hidden md:flex' : 'flex',
          ].join(' ')}>
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="font-semibold text-gray-800 text-sm">Conversations</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ConversationList
                conversations={conversations}
                activeId={activeConv?.user_id}
                onSelect={handleSelect}
                loading={loadingConvs}
              />
            </div>
          </div>

          {/* Right: chat */}
          <div className={[
            'flex-1 min-w-0',
            mobileShowChat ? 'flex flex-col' : 'hidden md:flex md:flex-col',
          ].join(' ')}>
            <ChatPanel
              conversation={activeConv}
              currentUserId={user?.id}
              onBack={handleBack}
              onNewMessage={handleNewMessage}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
