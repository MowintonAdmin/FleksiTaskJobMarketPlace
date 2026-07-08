import { useEffect, useRef, useState, useCallback } from 'react'
import { useSelector } from 'react-redux'
import { messagesApi } from '../api/messages'
import { toast } from 'react-toastify'
import usePolling from '../hooks/usePolling'

/* ── Helpers ──────────────────────────────────────────────────────────── */
function Avatar({ name, photo, size = 'md' }) {
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'
  if (photo) {
    return (
      <img
        src={photo}
        alt={name}
        referrerPolicy="no-referrer"
        className={`${sz} rounded-full object-cover shrink-0`}
      />
    )
  }
  return (
    <div className={`${sz} rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold shrink-0`}>
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

/* ── Conversation list ────────────────────────────────────────────────── */
function ConversationList({ conversations, activeId, onSelect, loading, onNewChat }) {
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

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-gray-100">
        <button
          onClick={onNewChat}
          className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          + New Message
        </button>
      </div>

      {conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center px-6">
          <p className="text-3xl mb-2">💬</p>
          <p className="text-sm font-medium text-gray-600">No conversations yet</p>
          <p className="text-xs text-gray-400 mt-1">Start a new message with a worker.</p>
        </div>
      ) : (
        <ul className="overflow-y-auto flex-1">
          {conversations.map((c) => (
            <li key={c.user_id}>
              <button
                onClick={() => onSelect(c)}
                className={[
                  'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                  c.user_id === activeId
                    ? 'bg-blue-50 border-l-2 border-blue-600'
                    : 'hover:bg-gray-50 border-l-2 border-transparent',
                ].join(' ')}
              >
                <div className="relative">
                  <Avatar name={c.user_name} photo={c.user_photo} />
                  {c.unread_count > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center font-bold">
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
      )}
    </div>
  )
}

/* ── Worker picker modal ──────────────────────────────────────────────── */
function WorkerPickerModal({ onClose, onSelect }) {
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    messagesApi.getWorkers()
      .then(setWorkers)
      .catch(() => toast.error('Failed to load workers'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = workers.filter((w) =>
    (w.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (w.email || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col" style={{ maxHeight: '80vh' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Select Worker</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
        </div>
        <div className="px-4 py-3 border-b border-gray-100">
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <ul className="overflow-y-auto flex-1">
          {loading ? (
            <li className="text-center py-8 text-gray-400 text-sm">Loading…</li>
          ) : filtered.length === 0 ? (
            <li className="text-center py-8 text-gray-400 text-sm">No workers found</li>
          ) : (
            filtered.map((w) => (
              <li key={w.id}>
                <button
                  onClick={() => onSelect(w)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left transition-colors"
                >
                  <Avatar name={w.full_name} photo={w.profile_photo_url} size="sm" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{w.full_name || 'Unknown'}</p>
                    <p className="text-xs text-gray-400">{w.email}</p>
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}

/* ── Chat panel ───────────────────────────────────────────────────────── */
const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

function ChatPanel({ conversation, currentUserId, onBack, onNewMessage }) {
  const [messages, setMessages] = useState([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [showReactions, setShowReactions] = useState(null)
  const [showQuickReplies, setShowQuickReplies] = useState(false)
  const [quickReplies, setQuickReplies] = useState([])
  const [isTyping, setIsTyping] = useState(false)
  const typingTimerRef = useRef(null)
  const bottomRef = useRef(null)
  const msgCountRef = useRef(0)
  const msgIdsRef = useRef(new Set())
  const onNewMsgRef = useRef(onNewMessage)
  useEffect(() => { onNewMsgRef.current = onNewMessage }, [onNewMessage])

  // Load quick replies
  useEffect(() => {
    messagesApi.getQuickReplies().then(setQuickReplies).catch(() => {})
  }, [])

  // Send typing indicator when user types
  useEffect(() => {
    if (!body.trim() || !conversation) return
    messagesApi.sendTyping(conversation.user_id).catch(() => {})
  }, [body, conversation])

  // Check if other user is typing (poll every 3s)
  useEffect(() => {
    if (!conversation) return
    const id = setInterval(async () => {
      try {
        const { typing } = await messagesApi.checkTyping(conversation.user_id)
        setIsTyping(typing)
      } catch {}
    }, 3000)
    return () => clearInterval(id)
  }, [conversation])

  const handleDelete = async (messageId) => {
    if (!window.confirm('Delete this message?')) return
    try {
      await messagesApi.deleteMessage(messageId)
      setMessages((prev) => prev.filter((m) => m.id !== messageId))
      onNewMessage?.()
    } catch {
      toast.error('Failed to delete message')
    }
  }

  const handleReact = async (messageId, emoji) => {
    try {
      const updated = await messagesApi.reactToMessage(messageId, emoji)
      setMessages((prev) => prev.map((m) => m.id === updated.id ? { ...m, reaction: updated.reaction } : m))
    } catch {
      toast.error('Failed to react')
    }
    setShowReactions(null)
  }

  const handleRemoveReaction = async (messageId) => {
    try {
      const updated = await messagesApi.reactToMessage(messageId, null)
      setMessages((prev) => prev.map((m) => m.id === updated.id ? { ...m, reaction: null } : m))
    } catch {}
    setShowReactions(null)
  }

  const load = useCallback(async () => {
    if (!conversation) return
    setLoading(true)
    try {
      const msgs = await messagesApi.getConversation(conversation.user_id)
      setMessages(msgs)
    } catch {
      toast.error('Failed to load messages')
    } finally {
      setLoading(false)
    }
  }, [conversation])

  useEffect(() => { load() }, [load])

  // Scroll to bottom only when messages are added
  useEffect(() => {
    const count = messages.length
    if (count > msgCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: msgCountRef.current === 0 ? 'instant' : 'smooth' })
    }
    msgCountRef.current = count
    msgIdsRef.current = new Set(messages.map((m) => m.id))
  }, [messages])

  // Poll every 3 s for new messages and read receipts
  useEffect(() => {
    if (!conversation) return
    const uid = conversation.user_id
    const intervalId = setInterval(async () => {
      try {
        const fresh = await messagesApi.getConversation(uid)
        const prevSize = msgIdsRef.current.size
        setMessages((prev) => {
          const freshMap = new Map(fresh.map((m) => [m.id, m]))
          const hasChange =
            prev.length !== fresh.length ||
            prev.some((m) => { const f = freshMap.get(m.id); return !f || f.is_read !== m.is_read || f.reaction !== m.reaction })
          return hasChange ? fresh : prev
        })
        if (fresh.length > prevSize) onNewMsgRef.current?.()
      } catch { /* silent */ }
    }, 3000)
    return () => clearInterval(intervalId)
  }, [conversation])

  const handleSend = async (e, presetBody) => {
    e?.preventDefault()
    const text = presetBody || body.trim()
    if (!text || sending) return
    setSending(true)
    try {
      const msg = await messagesApi.sendMessage(conversation.user_id, text)
      setMessages((prev) => [...prev, msg])
      setBody('')
      setShowQuickReplies(false)
      onNewMessage?.()
    } catch {
      toast.error('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  if (!conversation) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8">
        <p className="text-5xl mb-3">💬</p>
        <p className="font-semibold text-gray-700">Select a conversation</p>
        <p className="text-sm text-gray-400 mt-1">Choose from the list or start a new message.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with typing indicator */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white shrink-0">
        <button
          onClick={onBack}
          className="md:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 mr-1"
          aria-label="Back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <Avatar name={conversation.user_name} photo={conversation.user_photo} />
        <div>
          <p className="font-semibold text-gray-900 text-sm">{conversation.user_name || 'Unknown'}</p>
          {isTyping ? (
            <p className="text-xs text-green-600 font-medium animate-pulse">typing...</p>
          ) : conversation.user_email ? (
            <p className="text-xs text-gray-400">{conversation.user_email}</p>
          ) : null}
        </div>
      </div>

      {/* Messages with reactions */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 bg-gray-50" onClick={() => setShowReactions(null)}>
        {loading ? (
          <div className="flex justify-center items-center h-24">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-gray-400 mt-8">No messages yet. Say hello! 👋</p>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_id === currentUserId
            return (
              <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} group relative`}>
                <div className="flex items-end gap-1 max-w-[75%]">
                  {isMine && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowReactions(showReactions === msg.id ? null : msg.id) }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-400 hover:text-blue-500 p-1 shrink-0"
                      title="React"
                    >
                      😊
                    </button>
                  )}
                  <div className={`px-3.5 py-2.5 rounded-2xl text-sm shadow-sm relative ${
                    isMine
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                  }`}>
                    <p className="break-words">{msg.body}</p>
                    {msg.reaction && (
                      <span className="absolute -bottom-3 -right-1 text-base bg-white rounded-full px-1 shadow-sm border border-gray-100">
                        {msg.reaction}
                      </span>
                    )}
                    <p className={`text-[10px] mt-1 flex items-center justify-end gap-0.5 ${isMine ? 'text-blue-200' : 'text-gray-400'}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {isMine && (
                        <span className={`ml-1 font-bold ${msg.is_read ? 'text-blue-200' : 'text-blue-300'}`} title={msg.is_read ? 'Read' : 'Delivered'}>
                          {msg.is_read ? '✓✓' : '✓'}
                        </span>
                      )}
                    </p>
                  </div>
                  {!isMine && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowReactions(showReactions === msg.id ? null : msg.id) }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-400 hover:text-blue-500 p-1 shrink-0"
                      title="React"
                    >
                      😊
                    </button>
                  )}
                </div>
                {/* Reaction picker */}
                {showReactions === msg.id && (
                  <div className="flex gap-1 mt-1 bg-white rounded-full shadow-lg border border-gray-100 px-2 py-1.5 z-10" onClick={(e) => e.stopPropagation()}>
                    {REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleReact(msg.id, emoji)}
                        className={`hover:scale-125 transition-transform text-base ${msg.reaction === emoji ? 'scale-110 ring-2 ring-blue-300 rounded-full' : ''}`}
                      >
                        {emoji}
                      </button>
                    ))}
                    {msg.reaction && (
                      <button onClick={() => handleRemoveReaction(msg.id)} className="text-xs text-gray-400 hover:text-red-500 ml-1 self-center">✕</button>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick reply templates */}
      {showQuickReplies && (
        <div className="border-t border-gray-100 bg-white px-4 py-3 space-y-1.5 max-h-40 overflow-y-auto">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Quick Replies</p>
          {quickReplies.map((qr, i) => (
            <button
              key={i}
              onClick={() => handleSend(null, qr.text)}
              className="block w-full text-left text-sm text-gray-700 hover:bg-gray-50 rounded-lg px-3 py-2 transition-colors border border-gray-100"
            >
              <span className="text-xs font-medium text-blue-600 block">{qr.label}</span>
              <span className="text-xs text-gray-500">{qr.text}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 bg-white shrink-0">
        <button
          type="button"
          onClick={() => setShowQuickReplies(!showQuickReplies)}
          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 transition-colors ${showQuickReplies ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:bg-gray-100'}`}
          title="Quick replies"
        >
          ⚡
        </button>
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend(e)}
          placeholder="Type a message…"
          className="flex-1 px-4 py-2.5 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
          disabled={sending}
        />
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-full flex items-center justify-center shrink-0 transition-colors"
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
  const [conversations, setConversations] = useState([])
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [activeConv, setActiveConv] = useState(null)
  const [mobileShowChat, setMobileShowChat] = useState(false)
  const [showWorkerPicker, setShowWorkerPicker] = useState(false)

  const loadConversations = useCallback(async () => {
    try {
      const convs = await messagesApi.getConversations()
      setConversations(convs)
    } catch {
      toast.error('Failed to load conversations')
    } finally {
      setLoadingConvs(false)
    }
  }, [])

  useEffect(() => { loadConversations() }, [loadConversations])

  // Auto-refresh conversation list every 5s
  usePolling(loadConversations, 5000)

  const handleSelect = (conv) => {
    setActiveConv(conv)
    setMobileShowChat(true)
  }

  const handleWorkerSelect = (worker) => {
    setShowWorkerPicker(false)
    const existing = conversations.find((c) => c.user_id === worker.id)
    if (existing) {
      handleSelect(existing)
    } else {
      handleSelect({
        user_id: worker.id,
        user_name: worker.full_name || 'Worker',
        user_photo: worker.profile_photo_url || null,
        user_email: worker.email,
        last_message: '',
        last_message_at: new Date().toISOString(),
        unread_count: 0,
      })
    }
  }

  return (
    <div className="flex h-full overflow-hidden" style={{ height: 'calc(100vh - 0px)' }}>
      {/* Conversation list — hidden on mobile when chat open */}
      <div className={`w-full md:w-72 lg:w-80 border-r border-gray-200 bg-white flex flex-col shrink-0 ${mobileShowChat ? 'hidden md:flex' : 'flex'}`}>
        <div className="px-5 py-4 border-b border-gray-100">
          <h1 className="text-lg font-bold text-gray-900">💬 Messages</h1>
        </div>
        <div className="flex-1 overflow-hidden flex flex-col">
          <ConversationList
            conversations={conversations}
            activeId={activeConv?.user_id}
            onSelect={handleSelect}
            loading={loadingConvs}
            onNewChat={() => setShowWorkerPicker(true)}
          />
        </div>
      </div>

      {/* Chat panel */}
      <div className={`flex-1 flex flex-col overflow-hidden ${mobileShowChat ? 'flex' : 'hidden md:flex'}`}>
        <ChatPanel
          conversation={activeConv}
          currentUserId={user?.id}
          onBack={() => setMobileShowChat(false)}
          onNewMessage={loadConversations}
        />
      </div>

      {showWorkerPicker && (
        <WorkerPickerModal
          onClose={() => setShowWorkerPicker(false)}
          onSelect={handleWorkerSelect}
        />
      )}
    </div>
  )
}
