import { useEffect, useState, useCallback } from 'react'
import api from '../api/client'
import { toast } from 'react-toastify'
import SearchFilterBar from '../components/SearchFilterBar'
import RefreshButton from '../components/RefreshButton'
import usePolling from '../hooks/usePolling'

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
  withdrawn: 'bg-gray-100 text-gray-600',
}

const formatStatusLabel = (status) =>
  String(status || '')
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

function MessageModal({ worker, onClose }) {
  const [body, setBody] = useState('')
  const [messages, setMessages] = useState([])
  const [sending, setSending] = useState(false)

  useEffect(() => {
    api.get(`/messages/conversation/${worker.id}`)
      .then(r => setMessages(r.data))
      .catch(() => {})
  }, [worker.id])

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
            <p className="font-bold text-gray-900">💬 {worker.full_name}</p>
            <p className="text-xs text-gray-400">{worker.email}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-lg">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {messages.length === 0 && <p className="text-center text-gray-400 text-sm mt-8">No messages yet</p>}
          {messages.map(m => (
            <div key={m.id} className={`flex items-end gap-1 group ${m.sender_id !== worker.id ? 'justify-end' : 'justify-start'}`}>
              {m.sender_id !== worker.id && (
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
              <div className={`max-w-xs px-3 py-2 rounded-xl text-sm ${m.sender_id !== worker.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>
                {m.body}
                <p className={`text-xs mt-1 ${m.sender_id !== worker.id ? 'text-blue-200' : 'text-gray-400'}`}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              {m.sender_id === worker.id && (
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
          ))}
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

function WorkerDrawer({ worker, onClose, onMessage }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)

  useEffect(() => {
    Promise.all([
      api.get(`/admin/users/${worker.id}`),
      api.get(`/admin/users/${worker.id}/sessions`),
    ]).then(([userRes, sessRes]) => {
      setStats(userRes.data.stats)
      setSessions(sessRes.data)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [worker.id])

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30">
      <div className="bg-white w-full max-w-sm h-full overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <p className="font-bold text-gray-900">Worker Profile</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-lg">✕</button>
        </div>
        <div className="px-5 py-5 space-y-5">
          {/* Profile */}
          <div className="flex items-center gap-4">
            {worker.profile_photo_url
              ? <img src={worker.profile_photo_url} alt="" referrerPolicy="no-referrer" className="w-16 h-16 rounded-full object-cover" />
              : <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-2xl font-bold text-blue-600">{worker.full_name?.[0]}</div>
            }
            <div>
              <p className="font-bold text-gray-900">{worker.full_name}</p>
              <p className="text-sm text-gray-500">{worker.email}</p>
              {worker.location && <p className="text-xs text-gray-400 mt-0.5">📍 {worker.location}</p>}
            </div>
          </div>
          {worker.bio && <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{worker.bio}</p>}

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
          <button onClick={() => onMessage(worker)}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors">
            💬 Send Message
          </button>

          {/* Session history */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Past Sessions</p>
            {loading ? <div className="h-20 bg-gray-100 rounded-xl animate-pulse" /> :
              sessions.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">No sessions yet</p> :
              <div className="space-y-2">
                {sessions.map(s => (
                  <div key={s.id} className="bg-gray-50 rounded-xl p-3 text-sm">
                    <div className="flex justify-between items-start">
                      <p className="font-medium text-gray-800 truncate max-w-[160px]">{s.task_title}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {formatStatusLabel(s.status)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>⏱ {s.elapsed_minutes != null ? `${s.elapsed_minutes} min` : '—'}</span>
                      <span className="text-green-600 font-medium">{s.earnings != null ? `RM ${s.earnings.toFixed(2)}` : '—'}</span>
                    </div>
                    {s.proof_notes && <p className="text-xs text-gray-400 mt-1 italic truncate">"{s.proof_notes}"</p>}
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

export default function Applications() {
  const [apps, setApps] = useState([])
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterTask, setFilterTask] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [selectedWorker, setSelectedWorker] = useState(null)
  const [messageWorker, setMessageWorker] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterTask) params.set('task_id', filterTask)
    if (filterStatus) params.set('status', filterStatus)
    Promise.all([
      api.get(`/admin/applications?${params}`),
      api.get('/admin/tasks?page=1&page_size=100'),
    ]).then(([appsRes, tasksRes]) => {
      setApps(appsRes.data)
      setTasks(tasksRes.data.tasks || [])
    }).catch(() => toast.error('Failed to load applications'))
      .finally(() => setLoading(false))
  }, [filterTask, filterStatus])

  useEffect(() => { load() }, [load])

  // Auto-refresh applications list every 5s
  usePolling(load, 5000)

  const updateStatus = async (id, newStatus) => {
    try {
      await api.patch(`/applications/${id}/status`, { status: newStatus })
      setApps(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a))
      toast.success(`Application ${newStatus}`)
    } catch { toast.error('Update failed') }
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Applications <span className="text-gray-400 font-normal text-lg">({apps.length})</span>
        </h1>
        <RefreshButton onClick={load} loading={loading} />
      </div>

      {/* Search + Filters */}
      <SearchFilterBar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search by worker name, email or task title…"
        filters={[
          {
            value: filterTask,
            onChange: setFilterTask,
            options: [
              { value: '', label: 'All tasks' },
              ...tasks.map(t => ({ value: t.id, label: t.title })),
            ],
          },
          {
            value: filterStatus,
            onChange: setFilterStatus,
            options: [
              { value: '', label: 'All statuses' },
              { value: 'pending', label: 'Pending' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' },
              { value: 'withdrawn', label: 'Withdrawn' },
            ],
          },
        ]}
      />

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 text-left">Worker</th>
              <th className="px-4 py-3 text-left">Task</th>
              <th className="px-4 py-3 text-left">Note</th>
              <th className="px-4 py-3 text-left">Applied</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              [1,2,3].map(i => (
                <tr key={i}>{[1,2,3,4,5,6].map(j => (
                  <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                ))}</tr>
              ))
            ) : apps.filter(a => {
              if (!search) return true
              const q = search.toLowerCase()
              return (a.worker?.full_name || '').toLowerCase().includes(q) ||
                     (a.worker?.email || '').toLowerCase().includes(q) ||
                     (a.task?.title || '').toLowerCase().includes(q)
            }).length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">No applications match your search</td></tr>
            ) : apps.filter(a => {
              if (!search) return true
              const q = search.toLowerCase()
              return (a.worker?.full_name || '').toLowerCase().includes(q) ||
                     (a.worker?.email || '').toLowerCase().includes(q) ||
                     (a.task?.title || '').toLowerCase().includes(q)
            }).map(app => (
              <tr key={app.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <button onClick={() => setSelectedWorker(app.worker)} className="flex items-center gap-2 hover:text-blue-600 text-left">
                    {app.worker?.profile_photo_url
                      ? <img src={app.worker.profile_photo_url} alt="" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full object-cover" />
                      : <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600">{app.worker?.full_name?.[0] ?? '?'}</div>
                    }
                    <span className="font-medium text-gray-900">{app.worker?.full_name ?? '—'}</span>
                  </button>
                </td>
                <td className="px-4 py-3 text-gray-600 min-w-[160px]">{app.task?.title ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500 min-w-[160px] italic text-xs whitespace-pre-wrap break-words">{app.cover_note ?? '—'}</td>
                <td className="px-4 py-3 text-gray-400 text-xs">{new Date(app.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[app.status]}`}>
                    {formatStatusLabel(app.status)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1.5">
                    {app.status === 'pending' && (
                      <>
                        <button onClick={() => updateStatus(app.id, 'approved')}
                          className="px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors">
                          ✓ Approve
                        </button>
                        <button onClick={() => updateStatus(app.id, 'rejected')}
                          className="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-semibold rounded-lg transition-colors">
                          ✗ Reject
                        </button>
                      </>
                    )}
                    {app.worker && (
                      <button onClick={() => setMessageWorker(app.worker)}
                        title="Send message"
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition-colors">
                        💬
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedWorker && (
        <WorkerDrawer
          worker={selectedWorker}
          onClose={() => setSelectedWorker(null)}
          onMessage={(w) => { setSelectedWorker(null); setMessageWorker(w) }}
        />
      )}
      {messageWorker && <MessageModal worker={messageWorker} onClose={() => setMessageWorker(null)} />}
    </div>
  )
}
