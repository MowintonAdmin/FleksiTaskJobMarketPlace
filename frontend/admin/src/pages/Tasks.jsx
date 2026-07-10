import { useEffect, useState, useRef } from 'react'
import { toast } from 'react-toastify'
import api, { apiBaseUrl } from '../api/client'
import SearchFilterBar from '../components/SearchFilterBar'
import RefreshButton from '../components/RefreshButton'

// Route media through /api/v1/files/... — same proxy path as all API calls.
const mediaUrl = (path) => {
  if (!path) return null
  const filename = path.replace(/^\/media\//, '')
  return `${apiBaseUrl}/files/${filename}`
}

const CATEGORIES = ['Cleaning', 'Delivery', 'Moving', 'Gardening', 'Repair', 'Cooking', 'Security', 'Events', 'Other']

const STATUS_STYLE = {
  open: 'bg-green-100 text-green-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-500',
}

const ALL_STATUSES = ['open', 'in_progress', 'completed', 'cancelled']

const PROJECT_STATUS_STYLE = {
  active: 'bg-green-100 text-green-700',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-500',
}

const EMPTY_TASK_FORM = {
  title: '',
  description: '',
  requirements: '',
  location: '',
  category: 'Cleaning',
  pay_rate_per_hour: '',
  estimated_duration_hours: '',
  max_applicants: 1,
  starts_at: '',
}

// ── Project Modal ──────────────────────────────────────────────────────────

function ProjectModal({ project, onClose, onSaved }) {
  const [name, setName] = useState(project?.name || '')
  const [description, setDescription] = useState(project?.description || '')
  const [category, setCategory] = useState(project?.category || '')
  const [location, setLocation] = useState(project?.location || '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) { toast.error('Project name is required'); return }
    setSaving(true)
    try {
      const payload = { name: name.trim(), description: description.trim() || null, category: category || null, location: location.trim() || null }
      if (project) {
        await api.put(`/admin/projects/${project.id}`, payload)
        toast.success('Project updated!')
      } else {
        await api.post('/admin/projects', payload)
        toast.success('Project created!')
      }
      onSaved()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to save project')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{project ? 'Edit Project' : 'New Project'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Project Name *</label>
            <input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Office Tower Cleaning Q3" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Description</label>
            <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                <option value="">— None —</option>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Location</label>
              <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. KL City Centre" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : project ? 'Save Changes' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Task Modal ─────────────────────────────────────────────────────────────

function TaskModal({ task, projectId, onClose, onSaved }) {
  const [form, setForm] = useState(task ? {
    title: task.title,
    description: task.description,
    requirements: task.requirements ?? '',
    location: task.location,
    category: task.category,
    pay_rate_per_hour: (task.pay_rate_per_minute * 60).toFixed(2),
    estimated_duration_hours: Math.round(task.estimated_duration_minutes / 60) || '',
    max_applicants: task.max_applicants,
    starts_at: task.starts_at ? task.starts_at.slice(0, 16) : '',
  } : { ...EMPTY_TASK_FORM })
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(task?.photo_url ? mediaUrl(task.photo_url) : null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)
  const fileRef = useRef()

  const handleRemovePhoto = () => {
    setPhotoFile(null); setPhotoPreview(null); setRemovePhoto(true)
    if (fileRef.current) fileRef.current.value = ''
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Photo is too large. Maximum size is 5MB.'); e.target.value = ''; return }
    setPhotoFile(file); setPhotoPreview(URL.createObjectURL(file)); setRemovePhoto(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.starts_at && new Date(form.starts_at) < new Date()) { alert('Start date cannot be in the past.'); return }
    setSaving(true)
    try {
      const payload = {
        ...form,
        pay_rate_per_minute: parseFloat(form.pay_rate_per_hour) / 60,
        estimated_duration_minutes: Math.round(parseFloat(form.estimated_duration_hours) * 60),
        max_applicants: parseInt(form.max_applicants),
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
        requirements: form.requirements || null,
        project_id: projectId,
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
        const { data } = await api.post(`/tasks/${saved.id}/photo`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        saved = data
      } else if (removePhoto && task) {
        const { data } = await api.put(`/tasks/${saved.id}`, { photo_url: null })
        saved = data
      }

      toast.success(task ? 'Task updated!' : 'Task created!')
      onSaved(saved)
    } catch (err) {
      const detail = err.response?.data?.detail
      const msg = Array.isArray(detail) ? detail.map(d => d.msg || JSON.stringify(d)).join(', ') : (detail || err.message || 'Failed to save task')
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
          {formError && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2.5 text-sm">⚠️ {formError}</div>}
          {/* Photo */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Task Photo <span className="text-gray-400 normal-case font-normal">(optional)</span></label>
            <div className="flex items-center gap-4">
              <label className="cursor-pointer group shrink-0">
                <div className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 group-hover:border-blue-400 overflow-hidden flex items-center justify-center transition-colors">
                  {photoPreview ? <img src={photoPreview} alt="preview" className="w-full h-full object-cover" /> : <span className="text-3xl">📷</span>}
                </div>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoChange} />
              </label>
              <div className="text-sm text-gray-500 space-y-1.5">
                <p className="font-medium text-blue-600 cursor-pointer hover:underline" onClick={() => fileRef.current?.click()}>{photoPreview ? 'Change photo' : 'Click to upload photo'}</p>
                <p className="text-xs text-gray-400">JPG, PNG, WebP · max 5MB</p>
                {photoPreview && <button type="button" onClick={handleRemovePhoto} className="text-xs text-red-500 hover:text-red-700 hover:underline">✕ Remove photo</button>}
              </div>
            </div>
          </div>
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Title *</label>
            <input required value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Office Cleaning – Mon 9am" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Description *</label>
            <textarea required rows={3} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Describe what needs to be done…" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none" />
          </div>
          {/* Requirements */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Requirements <span className="text-gray-400 normal-case font-normal">(optional)</span></label>
            <textarea rows={2} value={form.requirements} onChange={e => set('requirements', e.target.value)} placeholder="e.g. Must bring own supplies, wear uniform…" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none" />
          </div>
          {/* Location + Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Location *</label>
              <input required value={form.location} onChange={e => set('location', e.target.value)} placeholder="e.g. KL City Centre" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Category *</label>
              <select value={form.category} onChange={e => set('category', e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          {/* Pay + Duration + Workers */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Pay/hour (RM) *</label>
              <input required type="number" step="0.50" min="1" value={form.pay_rate_per_hour} onChange={e => set('pay_rate_per_hour', e.target.value)} placeholder="15.00" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Duration (hours) *</label>
              <input required type="number" step="0.5" min="0.5" value={form.estimated_duration_hours} onChange={e => set('estimated_duration_hours', e.target.value)} placeholder="2" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Workers needed *</label>
              <input required type="number" step="1" min="1" value={form.max_applicants} onChange={e => set('max_applicants', e.target.value)} placeholder="1" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
          </div>
          {/* Pay estimate */}
          {parseFloat(form.pay_rate_per_hour) > 0 && parseInt(form.estimated_duration_hours) > 0 && (
            <div className="bg-blue-50 rounded-lg px-4 py-2.5 text-sm text-blue-700 flex flex-wrap gap-3">
              <span>💰 Per worker: <strong>RM {(parseFloat(form.pay_rate_per_hour) * parseInt(form.estimated_duration_hours)).toFixed(2)}</strong></span>
              {parseInt(form.max_applicants) > 1 && <span className="text-blue-500">· {form.max_applicants} workers total: <strong>RM {(parseFloat(form.pay_rate_per_hour) * parseInt(form.estimated_duration_hours) * parseInt(form.max_applicants)).toFixed(2)}</strong></span>}
            </div>
          )}
          {/* Starts at */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Start Date & Time <span className="text-gray-400 normal-case font-normal">(optional)</span></label>
            <input type="datetime-local" value={form.starts_at} onChange={e => set('starts_at', e.target.value)} min={new Date(Date.now() + 60000).toISOString().slice(0, 16)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
        </form>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : task ? 'Save Changes' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Cancel Confirm ─────────────────────────────────────────────────────────

function CancelConfirm({ task, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false)
  const confirm = async () => {
    setLoading(true)
    try { await api.put(`/tasks/${task.id}`, { status: 'cancelled' }); toast.success('Task cancelled'); onConfirm() } 
    catch { toast.error('Failed to cancel task') } 
    finally { setLoading(false); onClose() }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <p className="text-3xl text-center">⚠️</p>
        <h3 className="text-center font-bold text-gray-900">Cancel this task?</h3>
        <p className="text-center text-sm text-gray-500">"{task.title}" will be marked as cancelled. Workers won't be able to apply.</p>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Keep</button>
          <button onClick={confirm} disabled={loading} className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">{loading ? 'Cancelling…' : 'Yes, Cancel'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Delete Project Confirm ─────────────────────────────────────────────────

function DeleteProjectConfirm({ project, onClose, onConfirm }) {
  const [loading, setLoading] = useState(false)
  const confirm = async () => {
    setLoading(true)
    try { await api.delete(`/admin/projects/${project.id}`); toast.success('Project deleted'); onConfirm() } 
    catch (e) { toast.error(e.response?.data?.detail || 'Failed to delete project') } 
    finally { setLoading(false); onClose() }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <p className="text-3xl text-center">⚠️</p>
        <h3 className="text-center font-bold text-gray-900">Delete this project?</h3>
        <p className="text-center text-sm text-gray-500">"{project.name}" will be permanently removed.</p>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">Keep</button>
          <button onClick={confirm} disabled={loading} className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">{loading ? 'Deleting…' : 'Yes, Delete'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Task Table ─────────────────────────────────────────────────────────────

function TaskTable({ tasks, loading, search, onEdit, onCancel, onStatusChange, savingStatus }) {
  const displayed = search
    ? tasks.filter(t => t.title.toLowerCase().includes(search.toLowerCase()) || t.location.toLowerCase().includes(search.toLowerCase()))
    : tasks

  if (loading) {
    return (
      <div className="space-y-2">
        {[1,2,3,4,5].map(i => (
          <div key={i} className="bg-white rounded-xl p-4 animate-pulse flex gap-4">
            <div className="w-9 h-9 bg-gray-200 rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/3" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (displayed.length === 0) {
    return <div className="bg-white rounded-xl p-12 text-center"><p className="text-5xl mb-3">📋</p><p className="font-semibold text-gray-600">No tasks found</p></div>
  }

  return (
    <div className="space-y-3">
      {displayed.map(task => (
        <div key={task.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
          <div className="shrink-0">
            {task.photo_url ? (
              <img src={mediaUrl(task.photo_url)} alt="" className="w-10 h-10 rounded-lg object-cover" onError={e => { e.currentTarget.style.display='none'; e.currentTarget.nextSibling.style.display='flex' }} />
            ) : null}
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-lg" style={{ display: task.photo_url ? 'none' : 'flex' }}>📋</div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate">{task.title}</p>
            <p className="text-xs text-gray-500 mt-0.5">📍 {task.location} · {task.category} · RM {(parseFloat(task.pay_rate_per_minute) * 60).toFixed(2)}/hr</p>
            <div className="flex items-center gap-3 mt-1">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[task.status] ?? 'bg-gray-100 text-gray-600'}`}>
                {task.status.replace('_', ' ').toUpperCase()}
              </span>
              {task.starts_at && (
                <span className={`text-xs ${new Date(task.starts_at) < new Date() ? 'text-red-500' : 'text-gray-400'}`}>
                  🗓 {new Date(task.starts_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                </span>
              )}
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <select
              value={task.status}
              disabled={savingStatus === task.id}
              onChange={e => onStatusChange(task, e.target.value)}
              className="text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer focus:ring-2 focus:ring-blue-400 disabled:opacity-50 bg-gray-100 text-gray-700"
            >
              {ALL_STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ').toUpperCase()}</option>)}
            </select>
            {task.status === 'open' && (
              <>
                <button onClick={() => onEdit(task)} title="Edit" className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 text-base">✏️</button>
                <button onClick={() => onCancel(task)} title="Cancel" className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 text-base">🚫</button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main Tasks Page ────────────────────────────────────────────────────────

export default function Tasks() {
  const [view, setView] = useState('projects') // 'projects' | 'tasks'
  const [selectedProject, setSelectedProject] = useState(null)

  // Projects state
  const [projects, setProjects] = useState([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [projectSearch, setProjectSearch] = useState('')

  // Tasks state
  const [tasks, setTasks] = useState([])
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalTasks, setTotalTasks] = useState(0)

  // Modal state
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [editProject, setEditProject] = useState(null)
  const [deleteProject, setDeleteProject] = useState(null)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [editTask, setEditTask] = useState(null)
  const [cancelTask, setCancelTask] = useState(null)
  const [savingStatus, setSavingStatus] = useState(null)

  const loadProjects = async () => {
    try {
      const { data } = await api.get('/admin/projects')
      setProjects(data.projects || [])
    } catch { toast.error('Failed to load projects') } 
    finally { setLoadingProjects(false) }
  }

  const loadTasks = async (p = 1) => {
    if (!selectedProject) return
    setLoadingTasks(true)
    try {
      const params = new URLSearchParams({ page: p, page_size: 15 })
      params.set('project_id', selectedProject.id)
      if (filterStatus) params.set('status', filterStatus)
      const { data } = await api.get(`/admin/tasks?${params}`)
      setTasks(data.tasks || [])
      setTotalPages(data.total_pages || 1)
      setTotalTasks(data.total || 0)
    } catch { toast.error('Failed to load tasks') }
    finally { setLoadingTasks(false) }
  }

  useEffect(() => { loadProjects() }, [])
  useEffect(() => { if (view === 'tasks') loadTasks(page) }, [view, page, filterStatus])

  const handleSelectProject = (project) => {
    setSelectedProject(project)
    setView('tasks')
    setPage(1)
    setSearch('')
    setFilterStatus('')
  }

  const handleStatusChange = async (task, newStatus) => {
    if (newStatus === task.status) return
    setSavingStatus(task.id)
    try {
      await api.put(`/tasks/${task.id}`, { status: newStatus })
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
      toast.success(`Status updated to "${newStatus.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}"`)
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed to update status') }
    finally { setSavingStatus(null) }
  }

  const handleBack = () => {
    setView('projects')
    setSelectedProject(null)
    setTasks([])
    setPage(1)
  }

  // Filter projects by search
  const filteredProjects = projectSearch
    ? projects.filter(p => 
        p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(projectSearch.toLowerCase())) ||
        (p.category && p.category.toLowerCase().includes(projectSearch.toLowerCase())) ||
        (p.location && p.location.toLowerCase().includes(projectSearch.toLowerCase()))
      )
    : projects

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {view === 'tasks' && (
            <button onClick={handleBack} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 text-lg" title="Back to projects">←</button>
          )}
          <h1 className="text-2xl font-bold text-gray-900">
            {view === 'projects' ? 'Projects / Tasks' : selectedProject?.name || 'Tasks'}
            <span className="text-gray-400 font-normal text-lg ml-2">
              ({view === 'projects' ? projects.length : totalTasks})
            </span>
          </h1>
        </div>
        <RefreshButton onClick={view === 'projects' ? loadProjects : () => loadTasks(page)} loading={view === 'projects' ? loadingProjects : loadingTasks} />
      </div>

      {/* ── Projects View ──────────────────────────────────────────────────── */}
      {view === 'projects' && (
        <>
          <SearchFilterBar
            search={projectSearch}
            onSearchChange={setProjectSearch}
            placeholder="Search projects by name, category, or location…"
            filters={[]}
            rightContent={
              <button onClick={() => { setEditProject(null); setShowProjectModal(true) }} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
                + New Project
              </button>
            }
          />

          {loadingProjects ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="bg-white rounded-xl p-5 animate-pulse"><div className="h-5 bg-gray-200 rounded w-1/3 mb-2" /><div className="h-3 bg-gray-100 rounded w-1/2" /></div>)}</div>
          ) : filteredProjects.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center">
              <p className="text-5xl mb-3">📁</p>
              <p className="font-semibold text-gray-600">{projectSearch ? 'No projects match your search' : 'No projects yet'}</p>
              <p className="text-sm text-gray-400 mt-1">{projectSearch ? 'Try a different search term.' : 'Create your first project to start organizing tasks.'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.map(p => (
                <div key={p.id} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden group cursor-pointer" onClick={() => handleSelectProject(p)}>
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-bold text-gray-900 text-lg">{p.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PROJECT_STATUS_STYLE[p.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {p.status.toUpperCase()}
                      </span>
                    </div>
                    {p.description && <p className="text-sm text-gray-500 mb-3 line-clamp-2">{p.description}</p>}
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span>📋 {p.task_count} tasks</span>
                      {p.category && <span>🏷 {p.category}</span>}
                      {p.location && <span>📍 {p.location}</span>}
                    </div>
                  </div>
                  <div className="border-t border-gray-100 flex opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); setEditProject(p); setShowProjectModal(true) }} className="flex-1 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors border-r border-gray-100">
                      ✏️ Edit
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteProject(p) }} className="flex-1 py-2 text-xs font-semibold text-red-500 hover:bg-red-50 transition-colors">
                      🗑 Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Tasks View ─────────────────────────────────────────────────────── */}
      {view === 'tasks' && selectedProject && (
        <>
          <div className="flex flex-col sm:flex-row gap-3">
            <input type="text" placeholder="Search by title or location…" value={search} onChange={e => setSearch(e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }} className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
              <option value="">All statuses</option>
              <option value="open">OPEN</option>
              <option value="in_progress">IN PROGRESS</option>
              <option value="completed">COMPLETED</option>
              <option value="cancelled">CANCELLED</option>
            </select>
            <button onClick={() => { setEditTask(null); setShowTaskModal(true) }} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shrink-0">
              + New Task
            </button>
          </div>

          <TaskTable
            tasks={tasks}
            loading={loadingTasks}
            search={search}
            onEdit={(t) => { setEditTask(t); setShowTaskModal(true) }}
            onCancel={setCancelTask}
            onStatusChange={handleStatusChange}
            savingStatus={savingStatus}
          />

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">← Prev</button>
              <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50">Next →</button>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showProjectModal && <ProjectModal project={editProject} onClose={() => { setShowProjectModal(false); setEditProject(null) }} onSaved={() => { setShowProjectModal(false); setEditProject(null); loadProjects() }} />}
      {deleteProject && <DeleteProjectConfirm project={deleteProject} onClose={() => setDeleteProject(null)} onConfirm={() => { setDeleteProject(null); loadProjects() }} />}
      {showTaskModal && <TaskModal task={editTask} projectId={selectedProject?.id} onClose={() => { setShowTaskModal(false); setEditTask(null) }} onSaved={() => { setShowTaskModal(false); setEditTask(null); loadTasks(page) }} />}
      {cancelTask && <CancelConfirm task={cancelTask} onClose={() => setCancelTask(null)} onConfirm={() => loadTasks(page)} />}
    </div>
  )
}