import { useEffect, useState, useCallback } from 'react'
import api from '../api/client'
import { toast } from 'react-toastify'
import SearchFilterBar from '../components/SearchFilterBar'
import usePolling from '../hooks/usePolling'

const formatStatusLabel = (status) =>
  String(status || '')
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

/* ─── Message modal ──────────────────────────────────────────────────────── */
function MessageModal({ worker, onClose }) {
  const [body, setBody] = useState('')
  const [messages, setMessages] = useState([])
  const [sending, setSending] = useState(false)

  const reload = useCallback(() => {
    api.get(`/messages/conversation/${worker.id}`).then(r => setMessages(r.data)).catch(() => {})
  }, [worker.id])

  useEffect(() => { reload() }, [reload])

  const send = async () => {
    if (!body.trim()) return
    setSending(true)
    try {
      const { data } = await api.post('/messages', { recipient_id: worker.id, body: body.trim() })
      setMessages(m => [...m, data])
      setBody('')
    } catch { toast.error('Failed to send message') }
    finally { setSending(false) }
  }

  const deleteMsg = async (msgId) => {
    if (!window.confirm('Delete this message?')) return
    try {
      await api.delete(`/messages/${msgId}`)
      setMessages(m => m.filter(x => x.id !== msgId))
    } catch { toast.error('Failed to delete message') }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col" style={{ height: 480 }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="font-bold text-gray-900">💬 {worker.full_name || worker.email}</p>
            <p className="text-xs text-gray-400">{worker.email}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-lg">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {messages.length === 0 && <p className="text-center text-gray-400 text-sm mt-8">No messages yet. Start the conversation!</p>}
          {messages.map(m => {
            const isMine = m.sender_id !== worker.id
            return (
            <div key={m.id} className={`flex items-end gap-1 group ${isMine ? 'justify-end' : 'justify-start'}`}>
              {isMine && (
                <button
                  onClick={() => deleteMsg(m.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-400 p-1 shrink-0"
                  title="Delete message"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
              <div className={`max-w-xs px-3 py-2 rounded-xl text-sm ${isMine ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                {m.body}
                <p className={`text-xs mt-1 flex items-center gap-1 ${isMine ? 'justify-end text-blue-200' : 'text-gray-400'}`}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {isMine && (
                    m.is_read
                      ? <span title="Read" className="text-blue-200 font-bold tracking-tighter">✓✓</span>
                      : <span title="Sent" className="text-blue-300 tracking-tighter">✓</span>
                  )}
                </p>
              </div>
              {!isMine && (
                <button
                  onClick={() => deleteMsg(m.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-400 p-1 shrink-0"
                  title="Delete message"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
            )
          })}
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex gap-2">
          <input
            value={body} onChange={e => setBody(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Type a message…"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <button onClick={send} disabled={sending || !body.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-blue-700">
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Worker profile drawer ──────────────────────────────────────────────── */
function StarRater({ sessionId, currentRating, onRated }) {
  const [hover, setHover] = useState(0)
  const [saving, setSaving] = useState(false)

  const rate = async (value) => {
    setSaving(true)
    try {
      await api.post(`/task-sessions/${sessionId}/rate`, null, { params: { rating: value } })
      onRated(sessionId, value)
    } catch { /* ignore */ }
    finally { setSaving(false) }
  }

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} disabled={saving}
          onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)}
          onClick={() => rate(i)}
          className={`text-lg transition-colors ${
            i <= (hover || currentRating || 0) ? 'text-amber-400' : 'text-gray-300'
          } hover:scale-110 disabled:opacity-50`}>
          ★
        </button>
      ))}
      {currentRating && <span className="text-xs text-gray-400 ml-1">{currentRating.toFixed(1)}</span>}
    </div>
  )
}

function WorkerDrawer({ user, onClose, onMessage }) {
  const [profile, setProfile] = useState(null)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.get(`/admin/users/${user.id}`),
      api.get(`/admin/users/${user.id}/sessions`),
    ]).then(([p, s]) => {
      setProfile(p.data)
      setSessions(s.data)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [user.id])

  const handleRated = (sessionId, value) => {
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, rating: value } : s))
  }

  const stats = profile?.stats

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <div className="bg-white w-full max-w-sm h-full overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <p className="font-bold text-gray-900">Worker Profile</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-lg">✕</button>
        </div>
        <div className="px-5 py-5 space-y-5">
          {/* Avatar + info */}
          <div className="flex items-center gap-4">
            {user.profile_photo_url
              ? <img src={user.profile_photo_url} alt="" referrerPolicy="no-referrer" className="w-16 h-16 rounded-full object-cover" />
              : <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-2xl font-bold text-blue-600">
                  {(user.full_name || user.email || '?')[0].toUpperCase()}
                </div>
            }
            <div>
              <p className="font-bold text-gray-900">{user.full_name || '—'}</p>
              <p className="text-sm text-gray-500">{user.email}</p>
              {user.location && <p className="text-xs text-gray-400 mt-0.5">📍 {user.location}</p>}
            </div>
          </div>
          {user.bio && <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{user.bio}</p>}

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Sessions', value: stats.total_sessions },
                { label: 'Completed', value: stats.completed_sessions },
                { label: 'Earned', value: `RM ${stats.total_earnings.toFixed(2)}` },
              ].map(s => (
                <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-gray-900">{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Message button */}
          {!user.is_admin && (
            <button onClick={() => onMessage(user)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors">
              💬 Send Message
            </button>
          )}

          {/* Session history */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Session History</p>
            {loading ? <div className="h-20 bg-gray-100 rounded-xl animate-pulse" /> :
              sessions.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">No sessions yet</p> :
              <div className="space-y-2">
                {sessions.map(s => (
                  <div key={s.id} className="bg-gray-50 rounded-xl p-3 text-sm">
                    <div className="flex justify-between items-start">
                      <p className="font-medium text-gray-800 truncate max-w-[160px]">{s.task_title}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        s.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                      }`}>{formatStatusLabel(s.status)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>{new Date(s.checked_in_at).toLocaleDateString()}</span>
                      <span className="text-green-600 font-medium">
                        {s.earnings != null ? `RM ${s.earnings.toFixed(2)}` : '—'}
                      </span>
                    </div>
                    {s.status === 'COMPLETED' && (
                      <div className="mt-1.5">
                        <StarRater
                          sessionId={s.id}
                          currentRating={s.rating}
                          onRated={handleRated}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Main Users page ────────────────────────────────────────────────────── */
export default function Users() {
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState(null)
  const [messageTarget, setMessageTarget] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    const params = search ? { search } : {}
    api.get('/admin/users', { params })
      .then(r => setUsers(r.data.filter(u => !u.is_admin)))
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false))
  }, [search])

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [load])

  // Auto-refresh users list every 5s
  usePolling(load, 5000)

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Workers <span className="text-gray-400 font-normal text-lg">({users.length})</span>
        </h1>
      </div>

      <SearchFilterBar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search by name or email…"
        filters={[]}
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase border-b border-gray-100">
            <tr>
              <th className="px-5 py-3 text-left">Worker</th>
              <th className="px-5 py-3 text-left">Email</th>
              <th className="px-5 py-3 text-left">Location</th>
              <th className="px-5 py-3 text-center">Role</th>
              <th className="px-5 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              [1,2,3,4].map(i => (
                <tr key={i}>{[1,2,3,4,5].map(j => (
                  <td key={j} className="px-5 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                ))}</tr>
              ))
            ) : users.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">No users found</td></tr>
            ) : users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3">
                  <button onClick={() => setSelectedUser(u)}
                    className="flex items-center gap-3 hover:text-blue-600 transition-colors text-left">
                    {u.profile_photo_url
                      ? <img src={u.profile_photo_url} alt="" referrerPolicy="no-referrer" className="w-9 h-9 rounded-full object-cover" />
                      : <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600">
                          {(u.full_name || u.email || '?')[0].toUpperCase()}
                        </div>
                    }
                    <span className="font-medium text-gray-900">{u.full_name || '—'}</span>
                  </button>
                </td>
                <td className="px-5 py-3 text-gray-500">{u.email}</td>
                <td className="px-5 py-3 text-gray-500">{u.location || '—'}</td>
                <td className="px-5 py-3 text-center">
                  {u.is_admin
                    ? <span className="text-xs px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 font-medium">Admin</span>
                    : <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">Worker</span>
                  }
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => setSelectedUser(u)}
                      className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
                      Profile
                    </button>
                    {!u.is_admin && (
                      <button onClick={() => setMessageTarget(u)}
                        className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors">
                        💬 Message
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedUser && (
        <WorkerDrawer
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onMessage={u => { setSelectedUser(null); setMessageTarget(u) }}
        />
      )}
      {messageTarget && (
        <MessageModal worker={messageTarget} onClose={() => setMessageTarget(null)} />
      )}
    </div>
  )
}
