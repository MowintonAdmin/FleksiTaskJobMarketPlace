import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { taskSessionsApi, applicationsApi, tasksApi } from '../api/tasks'
import { apiHost } from '../api/client'

const mediaUrl = (path) => (path ? `${apiHost}${path}` : null)

/** Parse a datetime string from the backend, always treating it as UTC. */
function parseUTC(str) {
  if (!str) return null
  return new Date(/[Zz]|[+-]\d{2}:\d{2}$/.test(str) ? str : str + 'Z')
}

function formatDateTime(iso) {
  if (!iso) return '—'
  const d = parseUTC(iso)
  return d.toLocaleString('en-MY', { dateStyle: 'short', timeStyle: 'short' })
}

export default function TaskTracking() {
  const { applicationId } = useParams()
  const navigate = useNavigate()

  const [task, setTask] = useState(null)
  const [session, setSession] = useState(null)
  const [otherActiveSession, setOtherActiveSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  const [proofNotes, setProofNotes] = useState('')
  const [proofPhoto, setProofPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [showCheckout, setShowCheckout] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const apps = await applicationsApi.getMyApplications()
        const app = apps.find((a) => a.id === applicationId)
        if (!app) { navigate('/my-applications'); return }

        let taskData = app.task || null
        if (!taskData) {
          taskData = await tasksApi.getById(app.task_id)
        }
        setTask(taskData)

        let activeSession = null
        try {
          activeSession = await taskSessionsApi.getActiveSession()
        } catch {}
        if (activeSession && activeSession.application_id !== applicationId) {
          setOtherActiveSession(activeSession)
        }

        const sessions = await taskSessionsApi.getMySessions()
        const existing = sessions.find((s) => s.application_id === applicationId)
        if (existing) {
          setSession(existing)
        }
      } catch (err) {
        console.error('Task tracking load error:', err?.response?.data || err?.message || err)
        toast.error(err?.response?.data?.detail || err?.message || 'Failed to load task tracking info')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [applicationId, navigate])

  const handleCheckIn = async () => {
    setActionLoading(true)
    const resuming = session?.status === 'paused'
    try {
      const newSession = await taskSessionsApi.checkIn(applicationId)
      setSession(newSession)
      toast.success(resuming ? 'Task tracking resumed.' : 'Checked in! Clock started.')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Check-in failed')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCheckOut = async () => {
    setActionLoading(true)
    try {
      const completed = await taskSessionsApi.checkOut(session.id, proofNotes, proofPhoto)
      setSession(completed)
      setShowCheckout(false)
      toast.success('Work submitted! Awaiting admin approval.')
    } catch (e) {
      const detail = e.response?.data?.detail
      const msg = Array.isArray(detail)
        ? detail.map(d => d.msg || JSON.stringify(d)).join(', ')
        : (detail || e.message || 'Check-out failed')
      toast.error(msg)
    } finally {
      setActionLoading(false)
    }
  }

  const handlePhotoChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setProofPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  if (loading) return (
    <div className="max-w-lg mx-auto px-4 py-12 space-y-4">
      {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-5">
      {/* Task Header */}
      <div className="card">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Task</p>
        <h1 className="text-xl font-bold text-gray-900">{task?.title}</h1>
        <p className="text-sm text-gray-500 mt-1">📍 {task?.location}</p>
      </div>

      {/* Status Card */}
      {!session ? (
        <div className="card text-center space-y-4">
          <p className="text-4xl">🕐</p>
          {otherActiveSession ? (
            <>
              <p className="text-gray-600 font-medium">Another task is already being tracked</p>
              <p className="text-sm text-gray-400">
                You can only track one task at a time. Return to your active task before starting this one.
              </p>
              <button
                onClick={() => navigate(`/track/${otherActiveSession.application_id}`)}
                className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl transition-colors"
              >
                ↗ Go To Active Task
              </button>
            </>
          ) : (
            <>
              <p className="text-gray-600 font-medium">Ready to start work?</p>
              <p className="text-sm text-gray-400">Check in to begin tracking your time.</p>
              <button
                onClick={handleCheckIn}
                disabled={actionLoading}
                className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                {actionLoading ? 'Checking in…' : '✅ Check In & Start Work'}
              </button>
            </>
          )}
        </div>
      ) : session.status === 'active' ? (
        <div className="space-y-4">
          {/* Static check-in time display */}
          <div className="card text-center">
            <p className="text-4xl mb-2">👷</p>
            <p className="text-sm text-gray-500">Checked in at</p>
            <p className="text-lg font-bold text-gray-900">{formatDateTime(session.checked_in_at)}</p>
          </div>

          {!showCheckout ? (
            <button
              onClick={() => setShowCheckout(true)}
              disabled={actionLoading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
            >
              🏁 Check Out
            </button>
          ) : (
            <div className="card space-y-4">
              <h2 className="font-semibold text-gray-900">Submit Completion Proof</h2>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Photo Proof <span className="text-gray-400 normal-case font-normal">(optional)</span>
                </label>
                {photoPreview ? (
                  <div className="relative">
                    <img src={photoPreview} alt="proof" className="w-full max-h-40 rounded-xl object-cover" />
                    <button
                      type="button"
                      onClick={() => { setProofPhoto(null); setPhotoPreview(null) }}
                      className="absolute top-2 right-2 bg-white bg-opacity-90 hover:bg-red-50 text-red-500 rounded-full w-7 h-7 flex items-center justify-center shadow text-sm font-bold leading-none"
                      title="Remove photo"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl p-4 cursor-pointer hover:border-primary-400 transition-colors">
                    <span className="text-3xl mb-1">📷</span>
                    <span className="text-sm text-gray-500">Tap to upload photo</span>
                    <span className="text-xs text-gray-400">JPG, PNG, WebP · max 5MB</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handlePhotoChange}
                    />
                  </label>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Notes <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={proofNotes}
                  onChange={(e) => setProofNotes(e.target.value)}
                  placeholder="Describe what you completed…"
                  className="w-full text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCheckout(false)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCheckOut}
                  disabled={actionLoading}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
                >
                  {actionLoading ? 'Submitting…' : 'Confirm Check Out'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : session.status === 'paused' ? (
        <div className="card text-center space-y-4">
          <p className="text-5xl">⏸</p>
          <h2 className="text-xl font-bold text-gray-900">Task Paused</h2>
          <p className="text-sm text-gray-500">Your work session is currently paused.</p>
          <p className="text-xs text-amber-700">Resume to continue tracking from where you stopped.</p>

          <div className="space-y-3">
            <button
              onClick={handleCheckIn}
              disabled={actionLoading}
              className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {actionLoading ? 'Resuming…' : '▶ Resume Task Tracking'}
            </button>
            <button
              onClick={() => navigate('/my-applications')}
              className="w-full py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50"
            >
              ← Back to My Applications
            </button>
          </div>
        </div>
      ) : (
        <div className="card text-center space-y-4">
          <p className="text-5xl">🎉</p>
          <h2 className="text-xl font-bold text-gray-900">Work Completed!</h2>

          <p className="text-sm text-gray-600">
            Your task has been submitted for review. An admin will verify your work and credit the amount to your wallet within <strong>1-3 working days</strong>.
          </p>

          <div className="bg-blue-50 rounded-xl p-4 space-y-1 text-center">
            <p className="text-sm text-blue-700 font-medium">✅ Work submitted — awaiting admin approval</p>
            <p className="text-xs text-blue-600">
              Checked in: {formatDateTime(session.checked_in_at)}
            </p>
            <p className="text-xs text-blue-600">
              Checked out: {formatDateTime(session.checked_out_at)}
            </p>
            {session.proof_notes && (
              <p className="text-xs text-blue-600 mt-1">📝 {session.proof_notes}</p>
            )}
          </div>

          {session.proof_photo_url && (
            <img
              src={mediaUrl(session.proof_photo_url)}
              alt="Completion proof"
              className="w-full rounded-xl object-cover max-h-48"
            />
          )}

          <button
            onClick={() => navigate('/my-applications')}
            className="w-full py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50"
          >
            ← Back to My Applications
          </button>
        </div>
      )}
    </div>
  )
}