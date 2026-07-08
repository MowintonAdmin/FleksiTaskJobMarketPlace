import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { toast } from 'react-toastify'
import { fetchTaskById, clearSelectedTask } from '../store/taskSlice'
import { applicationsApi } from '../api/tasks'
import { apiHost } from '../api/client'

const mediaUrl = (path) => (path ? `${apiHost}${path}` : null)

export default function TaskDetail() {
  const { id } = useParams()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { selectedTask: task, loading } = useSelector((s) => s.tasks)
  const { user, accessToken } = useSelector((s) => s.auth)
  const [applying, setApplying] = useState(false)
  const [coverNote, setCoverNote] = useState('')
  const [applied, setApplied] = useState(false)

  useEffect(() => {
    dispatch(fetchTaskById(id))
    return () => dispatch(clearSelectedTask())
  }, [id, dispatch])

  const totalPay = task ? (task.pay_rate_per_minute * task.estimated_duration_minutes).toFixed(2) : 0
  const isExpired = task?.starts_at && new Date(task.starts_at) < new Date()

  const handleApply = async () => {
    if (!accessToken) { navigate('/login'); return }
    setApplying(true)
    try {
      await applicationsApi.apply(id, coverNote)
      setApplied(true)
      toast.success('Application submitted! You\'ll be notified of the status.')
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to apply'
      toast.error(msg)
    } finally {
      setApplying(false)
    }
  }

  if (loading || !task) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-2/3 mb-4" />
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-8" />
        <div className="h-40 bg-gray-200 rounded" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">
        ← Back
      </button>

      {task.photo_url && (
        <div className="mb-4 rounded-2xl overflow-hidden shadow">
          <img src={mediaUrl(task.photo_url)} alt={task.title} className="w-full max-h-64 object-cover" />
        </div>
      )}

      <div className="card mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full capitalize">
                {task.status
                  .split('_')
                  .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                  .join(' ')}
              </span>
              <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{task.category}</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{task.title}</h1>
            <p className="text-gray-500 mt-1 flex items-center gap-1">📍 {task.location}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-3xl font-bold text-primary-600">RM {totalPay}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100 text-center">
          <div>
            <p className="text-xs text-gray-500">Applications</p>
            <p className="font-semibold text-gray-900">{task.application_count}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Spots</p>
            <p className="font-semibold text-gray-900">{task.max_applicants}</p>
          </div>
        </div>
      </div>

      <div className="card mb-4">
        <h2 className="font-semibold text-gray-900 mb-2">Description</h2>
        <p className="text-gray-700 text-sm whitespace-pre-wrap">{task.description}</p>
      </div>

      {task.requirements && (
        <div className="card mb-4">
          <h2 className="font-semibold text-gray-900 mb-2">Requirements</h2>
          <p className="text-gray-700 text-sm whitespace-pre-wrap">{task.requirements}</p>
        </div>
      )}

      {task.starts_at && (
        <div className="card mb-4 flex items-center gap-2 text-sm text-gray-700">
          <span>🗓</span>
          <span>Starts: <strong>{new Date(task.starts_at).toLocaleString()}</strong></span>
        </div>
      )}

      {/* Apply Section */}
      {task.status === 'open' && !isExpired && (
        <div className="card">
          <h2 className="font-semibold text-gray-900 mb-3">Apply for this Task</h2>
          {applied ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
              <p className="text-green-700 font-semibold">✓ Application Submitted!</p>
              <p className="text-sm text-green-600 mt-1">You'll receive a notification when your application is reviewed.</p>
            </div>
          ) : (
            <>
              <textarea
                value={coverNote}
                onChange={(e) => setCoverNote(e.target.value)}
                rows={3}
                className="input resize-none mb-3"
                placeholder="Optional: Add a brief note about why you're a good fit..."
              />
              <button onClick={handleApply} disabled={applying} className="btn-primary w-full text-base py-3">
                {applying ? 'Submitting...' : '⚡ Apply Now (One Tap)'}
              </button>
              {!accessToken && (
                <p className="text-center text-xs text-gray-500 mt-2">
                  You'll be redirected to login first
                </p>
              )}
            </>
          )}
        </div>
      )}

      {/* Expired notice */}
      {task.status === 'open' && isExpired && (
        <div className="card border border-red-200 bg-red-50">
          <p className="text-red-700 font-semibold text-sm">⛔ Applications Closed</p>
          <p className="text-red-500 text-xs mt-1">The start date for this task has passed and it is no longer accepting applications.</p>
        </div>
      )}
    </div>
  )
}
