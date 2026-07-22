import { useEffect, useRef, useState, useCallback } from 'react'
import { useAutoRefresh } from '../utils/useAutoRefresh'
import { useSearchParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { toast } from 'react-toastify'
import { messagesApi } from '../api/messages'
import usePolling from '../hooks/usePolling'

const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

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
  const [showReactions, setShowReactions] = useState(null)
  const [isTyping, setIsTyping] = useState(false)
  const bottomRef = useRef(null)
  const msgCountRef = useRef(0)
  const msgIdsRef = useRef(new Set())
  const onNewMsgRef = useRef(onNewMessage)
  useEffect(() => { onNewMsgRef.current = onNewMessage }, [onNewMessage])

  // Send typing indicator when user types
  useEffect(() => {
    if (!body.trim() || !conversation) return
    messagesApi.sendTyping(conversation.user_id).catch(() => {})
  }, [body, conversation])

  // Check if other user is typing (poll every 1.5s)
  useEffect(() => {
    if (!conversation) return
    const id = setInterval(async () => {
      try {
        const { typing } = await messagesApi.checkTyping(conversation.user_id)
        setIsTyping(typing)
      } catch {}
    }, 1500)
    return () => clearInterval(id)
  }, [conversation])

  const handleDelete = async (messageId) => {
    if (!window.confirm('Delete this message?')) return
    try {
      const updated = await messagesApi.deleteMessage(messageId)
      setMessages((prev) => prev.map((m) => m.id === updated.id ? { ...m, body: updated.body, reaction: null } : m))
      onNewMessage?.()
    } catch {
      // silent
    }
  }

  const handleReact = async (messageId, emoji) => {
    try {
      const updated = await messagesApi.reactToMessage(messageId, emoji)
      setMessages((prev) => prev.map((m) => m.id === updated.id ? { ...m, reaction: updated.reaction } : m))
    } catch {}
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
      msgIdsRef.current = new Set(msgs.map((m) => m.id))
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [conversation])

  useEffect(() => { load() }, [load])

  // Scroll to bottom only when messages are added (not on is_read-only updates)
  useEffect(() => {
    const count = messages.length
    if (count > msgCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: msgCountRef.current === 0 ? 'instant' : 'smooth' })
    }
    msgCountRef.current = count
    msgIdsRef.current = new Set(messages.map((m) => m.id))
  }, [messages])

  // Poll every 3 s for new messages, read receipts, and reactions
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
      {/* Header with typing indicator */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white shrink-0">
        <button onClick={onBack} className="md:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 mr-1" aria-label="Back">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <Avatar name={conversation.user_name} photo={conversation.user_photo} />
        <div>
          <p className="font-semibold text-gray-900 text-sm">{conversation.user_name || 'Unknown'}</p>
          {isTyping && <p className="text-xs text-green-600 font-medium animate-pulse">typing...</p>}
        </div>
      </div>

      {/* Messages with reactions */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2" onClick={() => setShowReactions(null)}>
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
              <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} group relative`}>
                <div className="flex items-end gap-1 max-w-[75%]">
                  {isMine && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowReactions(showReactions === msg.id ? null : msg.id) }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-400 hover:text-primary-500 p-1 shrink-0"
                      title="React"
                    >
                      😊
                    </button>
                  )}
                  <div className={`px-3.5 py-2.5 rounded-2xl text-sm shadow-sm relative group/bubble ${
                    isMine
                      ? 'bg-primary-600 text-white rounded-br-sm'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                  }`}>
                    {msg.body === "This message was deleted" ? (
                      <p className="italic text-gray-400 text-xs">This message was deleted</p>
                    ) : (
                      <p className="break-words">{msg.body}</p>
                    )}
                    {msg.reaction && (
                      <span className="absolute -bottom-3 -right-1 text-base bg-white rounded-full px-1 shadow-sm border border-gray-100">
                        {msg.reaction}
                      </span>
                    )}
                    <p className={`text-[10px] mt-1 ${isMine ? 'text-primary-200 text-right' : 'text-gray-400'}`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {isMine && (
                        <span className="ml-1">{msg.is_read ? '✓✓' : '✓'}</span>
                      )}
                    </p>
                    {/* Delete button - shows on hover for own messages only */}
                    {isMine && msg.body !== "This message was deleted" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(msg.id) }}
                        className="absolute -top-2 -right-2 opacity-0 group-hover/bubble:opacity-100 transition-opacity bg-white rounded-full w-5 h-5 flex items-center justify-center shadow-sm border border-gray-200 text-xs text-gray-400 hover:text-red-500"
                        title="Delete message"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {!isMine && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowReactions(showReactions === msg.id ? null : msg.id) }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-400 hover:text-primary-500 p-1 shrink-0"
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
                        className={`hover:scale-125 transition-transform text-base ${msg.reaction === emoji ? 'scale-110 ring-2 ring-primary-300 rounded-full' : ''}`}
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
  const [mobileShowChat, setMobileShowChat] = useState(false)
  const [admins, setAdmins] = useState([])
  const [showAdminPicker, setShowAdminPicker] = useState(false)

  const loadConversations = useCallback(async () => {
    try {
      const [convs, adminList] = await Promise.all([
        messagesApi.getConversations(),
        messagesApi.getAdmins().catch(() => []),
      ])
      setConversations(convs)
      setAdmins(adminList)
      // Auto-select from URL param ?with=<userId>
      const withId = searchParams.get('with')
      if (withId) {
        const found = convs.find((c) => c.user_id === withId)
        if (found) {
          setActiveConv(found)
          setMobileShowChat(true)
        } else {
          // withId may be an admin not yet in conversations — open directly
          const admin = adminList.find((a) => a.id === withId)
          if (admin) {
            openAdminChat(admin, convs)
          }
        }
      }
    } catch {
      // silent
    } finally {
      setLoadingConvs(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const openAdminChat = (admin, convList = conversations) => {
    // Check if conversation already exists
    const existing = convList.find((c) => c.user_id === admin.id)
    if (existing) {
      handleSelect(existing)
    } else {
      // Create a synthetic conversation entry
      const synth = {
        user_id: admin.id,
        user_name: admin.full_name || 'Admin',
        user_photo: admin.profile_photo_url || null,
        last_message: '',
        last_message_at: new Date().toISOString(),
        unread_count: 0,
      }
      setActiveConv(synth)
      setMobileShowChat(true)
      setSearchParams({ with: admin.id })
    }
    setShowAdminPicker(false)
  }

  useEffect(() => { loadConversations() }, [loadConversations])

  // Auto-refresh conversation list every 5s so new messages appear
  usePolling(loadConversations, 5000)

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
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
              <p className="font-semibold text-gray-800 text-sm">Conversations</p>
              {admins.length > 0 && (
                <button
                  onClick={() => setShowAdminPicker(true)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-primary-50 text-primary-700 hover:bg-primary-100 rounded-lg font-medium transition-colors shrink-0"
                  title="Message an admin"
                >
                  🛡️ Message Admin
                </button>
              )}
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

      {/* Admin picker modal */}
      {showAdminPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowAdminPicker(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <p className="font-bold text-gray-900">🛡️ Message Admin</p>
              <button onClick={() => setShowAdminPicker(false)} className="text-gray-400 hover:text-gray-600 font-bold text-lg leading-none">✕</button>
            </div>
            <ul className="py-2 max-h-72 overflow-y-auto">
              {admins.map((admin) => (
                <li key={admin.id}>
                  <button
                    onClick={() => openAdminChat(admin)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    {admin.profile_photo_url
                      ? <img src={admin.profile_photo_url} alt="" referrerPolicy="no-referrer" className="w-10 h-10 rounded-full object-cover shrink-0" />
                      : <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-sm font-bold text-purple-600 shrink-0">
                          {(admin.full_name || '?')[0].toUpperCase()}
                        </div>
                    }
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{admin.full_name || 'Admin'}</p>
                      <p className="text-xs text-purple-600">Admin · Support</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
