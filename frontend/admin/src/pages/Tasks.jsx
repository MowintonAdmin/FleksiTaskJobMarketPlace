import { useEffect, useState, useRef } from 'react'
import { toast } from 'react-toastify'
import api, { apiHost, apiBaseUrl } from '../api/client'

// Strip /api/v1 suffix to get the media base URL.
// This uses the same origin resolution as the API client, ensuring images
// always load from the correct host regardless of nginx proxy configuration.
const mediaBase = apiBaseUrl.replace(/\/api\/v1$/, '')
const mediaUrl = (path) => path ? `${mediaBase}${path}` : null

console.log('[Tasks] apiHost:', apiHost, '| apiBaseUrl:', apiBaseUrl, '| mediaBase:', mediaBase)

const CATEGORIES = ['Cleaning', 'Delivery', 'Moving', 'Gardening', 'Repair', 'Cooking', 'Security', 'Events', 'Other']

const STATUS_STYLE = {
  open: 'bg-green-100 text-green-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-500',
}

const ALL_STATUSES = ['open', 'in_progress', 'completed', 'cancelled']

const EMPTY_FORM = {
  title: '',
  description: '',
  requirements: '',
  location: '',
  category: 'Cleaning',
  pay_rate_per_minute: '',
  estimated_duration_minutes: '',
  max_applicants: 1,
  starts_at: '',
}

function TaskModal({ task, onClose, onSaved }) {
  const [form, setForm] = useState(task ? {
    title: task.title,
    description: task.description,
    requirements: task.requirements ?? '',
    location: task.location,
    category: task.category,
    pay_rate_per_minute: task.pay_rate_per_minute,
    estimated_duration_minutes: task.estimated_duration_minutes,
    max_applicants: task.max_applicants,
    starts_at: task.starts_at ? task.starts_at.slice(0, 16) : '',
  } : { ...EMPTY_FORM })
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(task?.photo_url ? mediaUrl(task.photo_url) : null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)
  const fileRef = useRef()

  useEffect(() => {
    console.log('[TaskModal] opened. task.photo_url:', task?.photo_url, '| photoPreview:', task?.photo_url ? mediaUrl(task.photo_url) : null)
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...form,
        pay_rate_per_minute: parseFloat(form.pay_rate_per_minute),
        estimated_duration_minutes: parseInt(form.estimated_duration_minutes),
        max_applicants: parseInt(form.max_applicants),
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
        requirements: form.requirements || null,
      }

      let saved
      if (task) {
        const { data } = await api.put(`/tasks/${task.id}`, payload)
        saved = data
      } else {
        const { data } = await api.post('/tasks', payload)
        saved = data
      }

      if (photoFile) {
        const fd = new FormData()
        fd.append('photo', photoFile)
        const { data } = await api.post(`/tasks/${saved.id}/photo`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        saved = data
      }

      toast.success(task ? 'Task updated!' : 'Task created!')
      onSaved(saved)
    } catch (err) {
      const detail = err.response?.data?.detail
      const msg = Array.isArray(detail)
        ? detail.map(d => d.msg || JSON.stringify(d)).join(', ')
        : (detail || err.message || 'Failed to save task')
      setFormError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{task ? 'Edit Task' : 'Create New Task'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2.5 text-sm">
              ⚠️ {formError}
            </div>
          )}
          {/* Photo */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Task Photo <span className="text-gray-400 normal-case font-normal">(optional)</span>
            </label>
            <label className="flex items-center gap-4 cursor-pointer group">
              <div className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 group-hover:border-blue-400 overflow-hidden flex items-center justify-center shrink-0 transition-colors">
                {photoPreview
                  ? <img
                      src={photoPreview}
                      alt="preview"
                      className="w-full h-full object-cover"
                      onError={e => {
                        console.warn('[TaskModal] photo failed to load:', e.currentTarget.src)
                        e.currentTarget.replaceWith(Object.assign(document.createElement('span'), { textContent: '📷', className: 'text-3xl' }))
                      }}
                    />
                  : <span className="text-3xl">📷</span>
                }
              </div>
              <div className="text-sm text-gray-500">
                <p className="font-medium text-blue-600 group-hover:underline">Click to upload photo</p>
                <p className="text-xs mt-0.5">JPG, PNG, WebP · max 5MB</p>
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoChange} />
            </label>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Title *</label>
            <input
              required value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="e.g. Office Cleaning – Mon 9am"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Description *</label>
            <textarea
              required rows={3} value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Describe what needs to be done…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
            />
          </div>

          {/* Requirements */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
              Requirements <span className="text-gray-400 normal-case font-normal">(optional)</span>
            </label>
            <textarea
              rows={2} value={form.requirements} onChange={e => set('requirements', e.target.value)}
              placeholder="e.g. Must bring own supplies, wear uniform…"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
            />
          </div>

          {/* Location + Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Location *</label>
              <input
                required value={form.location} onChange={e => set('location', e.target.value)}
                placeholder="e.g. KL City Centre"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Category *</label>
              <select
                value={form.category} onChange={e => set('category', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Pay + Duration + Workers */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Pay/min (RM) *</label>
              <input
                required type="number" step="0.01" min="0.01"
                value={form.pay_rate_per_minute} onChange={e => set('pay_rate_per_minute', e.target.value)}
                placeholder="0.50"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Duration (min) *</label>
              <input
                required type="number" step="1" min="1"
                value={form.estimated_duration_minutes} onChange={e => set('estimated_duration_minutes', e.target.value)}
                placeholder="120"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Workers needed *</label>
              <input
                required type="number" step="1" min="1"
                value={form.max_applicants} onChange={e => set('max_applicants', e.target.value)}
                placeholder="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Pay estimate */}
          {parseFloat(form.pay_rate_per_minute) > 0 && parseInt(form.estimated_duration_minutes) > 0 && (
            <div className="bg-blue-50 rounded-lg px-4 py-2.5 text-sm text-blue-700 flex flex-wrap gap-3">
              <span>💰 Per worker: <strong>RM {(parseFloat(form.pay_rate_per_minute) * parseInt(form.estimated_duration_minutes)).toFixed(2)}</strong></span>
              {parseInt(form.max_applicants) > 1 && (
                <span className="text-blue-500">· {form.max_applicants} workers total: <strong>RM {(parseFloat(form.pay_rate_per_minute) * parseInt(form.estimated_duration_minutes) * parseInt(form.max_applicants)).toFixed(2)}</strong></span>
              )}
            </div>
          )}

          {/* Starts at */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
              Start Date &amp; Time <span className="text-gray-400 normal-case font-normal">(optional)</span>
            </label>
            <input
              type="datetime-local" value={form.starts_at} onChange={e => set('starts_at', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : task ? 'Save Changes' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  )
}

function RateTaskModal({ task, onClose, onSaved }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [rating, setRating] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [saving, setSaving] = useState(null) // session id being saved

  useEffect(() => {
    api.get(`/admin/time-logs?task_id=${task.id}&status=completed`)
      .then(r => setSessions(r.data))
      .catch(() => toast.error('Failed to load sessions'))
      .finally(() => setLoading(false))
  }, [task.id])

  const submitRating = async (sessionId) => {
    if (rating < 1 || rating > 5) { toast.error('Select a rating 1–5'); return }
    setSaving(sessionId)
    try {
      const params = new URLSearchParams({ rating, ...(feedback ? { feedback } : {}) })
      await api.post(`/task-sessions/${sessionId}/rate?${params}`)
      toast.success('Rating saved!')
      setSessions(prev => prev.map(s => s.session_id === sessionId ? { ...s, rating: parseFloat(rating) } : s))
      setRating(0)
      setFeedback('')
      onSaved()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save rating')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <p className="font-bold text-gray-900">Rate Task</p>
            <p className="text-xs text-gray-400 truncate max-w-xs">{task.title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-lg">✕</button>
        </div>

        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : sessions.length === 0 ? (
            <p className="text-center text-gray-400 py-6">No completed sessions for this task</p>
          ) : sessions.map(s => (
            <div key={s.session_id} className="border border-gray-100 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-start text-sm">
                <div>
                  <p className="font-medium text-gray-800">{s.worker_name}</p>
                  <p className="text-xs text-gray-400">
                    {s.checked_in_at ? new Date(s.checked_in_at).toLocaleString() : '—'}
                    {s.checked_out_at ? ` → ${new Date(s.checked_out_at).toLocaleString()}` : ''}
                  </p>
                  {s.elapsed_minutes != null && (
                    <p className="text-xs text-gray-400">⏱ {s.elapsed_minutes} min</p>
                  )}
                </div>
                <span className="text-green-600 font-semibold text-sm">RM {s.cost?.toFixed(2) ?? '—'}</span>
              </div>

              {s.rating != null ? (
                <div className="bg-green-50 rounded-lg px-3 py-2 text-sm">
                  <span className="font-medium text-green-700">Rated: {'★'.repeat(s.rating)}{'☆'.repeat(5 - s.rating)}</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(star => (
                      <button
                        key={star}
                        onClick={() => setRating(star)}
                        className={`text-2xl transition-colors ${
                          star <= rating ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-300'
                        }`}
                      >
                        ★
                      </button>
                    ))}
                    {rating > 0 && <span className="text-sm text-gray-500 self-center ml-1">{rating}/5</span>}
                  </div>
                  <input
                    type="text"
                    placeholder="Feedback (optional)"
                    value={feedback}
                    onChange={e => setFeedback(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <button
                    onClick={() => submitRating(s.session_id)}
                    disabled={saving === s.session_id || rating < 1}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {saving === s.session_id ? 'Saving…' : 'Submit Rating'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Close</button>
        </div>
      </div>
    </div>
  )
}

function CancelConfirm({ task, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false)
  const confirm = async () => {
    setLoading(true)
    try {
      await api.put(`/tasks/${task.id}`, { status: 'cancelled' })
      toast.success('Task cancelled')
      onConfirm()
    } catch {
      toast.error('Failed to cancel task')
    } finally {
      setLoading(false)
      onClose()
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <p className="text-3xl text-center">⚠️</p>
        <h3 className="text-center font-bold text-gray-900">Cancel this task?</h3>
        <p className="text-center text-sm text-gray-500">"{task.title}" will be marked as cancelled. Workers won't be able to apply.</p>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Keep</button>
          <button onClick={confirm} disabled={loading} className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">
            {loading ? 'Cancelling…' : 'Yes, Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Tasks() {
  const [data, setData] = useState({ tasks: [], total: 0, page: 1, total_pages: 1 })
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [editTask, setEditTask] = useState(null)
  const [cancelTask, setCancelTask] = useState(null)
  const [rateTask, setRateTask] = useState(null)
  const [savingStatus, setSavingStatus] = useState(null) // task id being updated

  const handleStatusChange = async (task, newStatus) => {
    if (newStatus === task.status) return
    setSavingStatus(task.id)
    try {
      await api.put(`/tasks/${task.id}`, { status: newStatus })
      setData(prev => ({
        ...prev,
        tasks: prev.tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t),
      }))
      toast.success(`Status updated to "${newStatus.replace('_', ' ')}"`)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update status')
    } finally {
      setSavingStatus(null)
    }
  }

  const load = (p = 1) => {
    setLoading(true)
    const params = new URLSearchParams({ page: p, page_size: 15 })
    if (filterStatus) params.set('status', filterStatus)
    api.get(`/admin/tasks?${params}`)
      .then((r) => {
        setData(r.data)
        const withPhotos = r.data.tasks.filter(t => t.photo_url)
        if (withPhotos.length) {
          console.log('[Tasks] Tasks with photos:', withPhotos.map(t => ({ title: t.title, photo_url: t.photo_url, resolved: mediaUrl(t.photo_url) })))
        }
      })
      .catch(() => toast.error('Failed to load tasks'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(1) }, [filterStatus])
  useEffect(() => { load(page) }, [page])

  const displayedTasks = search
    ? data.tasks.filter(t =>
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.location.toLowerCase().includes(search.toLowerCase())
      )
    : data.tasks

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">
          Tasks <span className="text-gray-400 font-normal text-lg">({data.total})</span>
        </h1>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          + New Task
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text" placeholder="Search by title or location…"
          value={search} onChange={e => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
        <select
          value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase border-b border-gray-100">
            <tr>
              <th className="px-4 py-3 text-left w-10"></th>
              <th className="px-4 py-3 text-left">Title</th>
              <th className="px-4 py-3 text-left">Location</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-right">Pay/min</th>
              <th className="px-4 py-3 text-right">Est. Total</th>
              <th className="px-4 py-3 text-center">Workers</th>
              <th className="px-4 py-3 text-left">Start Date</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              [1,2,3,4,5].map(i => (
                <tr key={i}>
                  {[1,2,3,4,5,6,7,8,9,10].map(j => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : displayedTasks.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-12 text-gray-400">No tasks found</td></tr>
            ) : displayedTasks.map((task) => (
              <tr key={task.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  {task.photo_url
                    ? <img src={mediaUrl(task.photo_url)} alt="" className="w-9 h-9 rounded-lg object-cover" onError={e => { console.warn('[Tasks] Image failed to load:', e.currentTarget.src); e.currentTarget.style.display='none'; e.currentTarget.nextSibling.style.display='flex' }} />
                    : null}
                  <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-base" style={{ display: task.photo_url ? 'none' : 'flex' }}>📋</div>
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">{task.title}</td>
                <td className="px-4 py-3 text-gray-600">📍 {task.location}</td>
                <td className="px-4 py-3 text-gray-500">{task.category}</td>
                <td className="px-4 py-3 text-right text-gray-700">RM {parseFloat(task.pay_rate_per_minute).toFixed(2)}</td>
                <td className="px-4 py-3 text-right font-semibold text-blue-600">
                  RM {(task.pay_rate_per_minute * task.estimated_duration_minutes).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-center text-gray-600">{task.max_applicants}</td>
                <td className="px-4 py-3 text-sm whitespace-nowrap">
                  {task.starts_at ? (
                    <span className={new Date(task.starts_at) < new Date() ? 'text-red-500' : 'text-gray-700'}>
                      {new Date(task.starts_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <select
                    value={task.status}
                    disabled={savingStatus === task.id}
                    onChange={e => handleStatusChange(task, e.target.value)}
                    className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 ${STATUS_STYLE[task.status] ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    {ALL_STATUSES.map(s => (
                      <option key={s} value={s}>{s.replace('_', ' ')}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1">
                    {task.status === 'open' ? (
                      <>
                        <button
                          onClick={() => setEditTask(task)}
                          title="Edit task"
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors text-base"
                        >✏️</button>
                        <button
                          onClick={() => setCancelTask(task)}
                          title="Cancel task"
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors text-base"
                        >🚫</button>
                      </>
                    ) : task.status === 'completed' ? (
                      <button
                        onClick={() => setRateTask(task)}
                        title="Rate task"
                        className="p-1.5 rounded-lg hover:bg-yellow-50 text-yellow-500 transition-colors text-base"
                      >★ Rate</button>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data.total_pages > 1 && (
        <div className="flex justify-center items-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">
            ← Prev
          </button>
          <span className="text-sm text-gray-500">Page {page} of {data.total_pages}</span>
          <button onClick={() => setPage(p => Math.min(data.total_pages, p + 1))} disabled={page === data.total_pages}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">
            Next →
          </button>
        </div>
      )}

      {showCreate && <TaskModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(page) }} />}
      {editTask && <TaskModal task={editTask} onClose={() => setEditTask(null)} onSaved={() => { setEditTask(null); load(page) }} />}
      {cancelTask && <CancelConfirm task={cancelTask} onClose={() => setCancelTask(null)} onConfirm={() => load(page)} />}
      {rateTask && <RateTaskModal task={rateTask} onClose={() => setRateTask(null)} onSaved={() => load(page)} />}
    </div>
  )
}
