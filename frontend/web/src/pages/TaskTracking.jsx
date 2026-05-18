import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { taskSessionsApi, applicationsApi, tasksApi } from '../api/tasks'
import { apiHost } from '../api/client'

const mediaUrl = (path) => (path ? `${apiHost}${path}` : null)

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return [h > 0 ? `${h}h` : null, `${m}m`, `${s}s`].filter(Boolean).join(' ')
}

/** Parse a datetime string from the backend, always treating it as UTC. */
function parseUTC(str) {
  if (!str) return null
  // If no timezone suffix present, append Z so the browser treats it as UTC
  return new Date(/[Zz]|[+-]\d{2}:\d{2}$/.test(str) ? str : str + 'Z')
}

export default function TaskTracking() {
  const { applicationId } = useParams()
  const navigate = useNavigate()

  const [task, setTask] = useState(null)
  const [session, setSession] = useState(null)
  const [otherActiveSession, setOtherActiveSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // Elapsed seconds (ticks every second while active)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef(null)

  // Checkout form
  const [proofNotes, setProofNotes] = useState('')
  const [proofPhoto, setProofPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [showCheckout, setShowCheckout] = useState(false)

  const minimumDurationSeconds = (task?.estimated_duration_minutes ?? 0) * 60

  const startTimer = useCallback((checkedInAt, maxSeconds) => {
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      const secs = Math.max(0, Math.floor((Date.now() - parseUTC(checkedInAt).getTime()) / 1000))
      if (maxSeconds > 0 && secs >= maxSeconds) {
        setElapsed(maxSeconds)
        clearInterval(timerRef.current)
        setShowCheckout(true)
      } else {
        setElapsed(secs)
      }
    }, 1000)
  }, [])

  useEffect(() => {
    async function load() {
      try {
        // Load application to get task info
        const apps = await applicationsApi.getMyApplications()
        const app = apps.find((a) => a.id === applicationId)
        if (!app) { navigate('/my-applications'); return }

        // Use embedded task data if available, otherwise fetch separately
        let taskData = app.task || null
        if (!taskData) {
          taskData = await tasksApi.getById(app.task_id)
        }
        setTask(taskData)

        // Fetch sessions — getActiveSession may return null; handle gracefully
        let activeSession = null
        try {
          activeSession = await taskSessionsApi.getActiveSession()
        } catch {
          // Non-critical — ignore if no active session endpoint fails
        }
        if (activeSession && activeSession.application_id !== applicationId) {
          setOtherActiveSession(activeSession)
        }

        // Check for existing session on this application
        const sessions = await taskSessionsApi.getMySessions()
        const existing = sessions.find((s) => s.application_id === applicationId)
        if (existing) {
          setSession(existing)
          if (existing.status === 'active') {
            const maxSecs = (taskData?.estimated_duration_minutes ?? 0) * 60
            const secs = Math.min(
              Math.max(0, Math.floor((Date.now() - parseUTC(existing.checked_in_at).getTime()) / 1000)),
              maxSecs || Infinity
            )
            setElapsed(secs)
            startTimer(existing.checked_in_at, maxSecs)
          }
        }
      } catch (err) {
        console.error('Task tracking load error:', err?.response?.data || err?.message || err)
        toast.error(err?.response?.data?.detail || err?.message || 'Failed to load task tracking info')
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => clearInterval(timerRef.current)
  }, [applicationId, navigate, startTimer])

  const handleCheckIn = async () => {
    setActionLoading(true)
    const resuming = session?.status === 'paused'
    try {
      const newSession = await taskSessionsApi.checkIn(applicationId)
      setSession(newSession)
      const maxSecs = (task?.estimated_duration_minutes ?? 0) * 60
      const secs = Math.min(
        Math.max(0, Math.floor((Date.now() - parseUTC(newSession.checked_in_at).getTime()) / 1000)),
        maxSecs || Infinity
      )
      setElapsed(secs)
      startTimer(newSession.checked_in_at, maxSecs)
      toast.success(resuming ? 'Task tracking resumed.' : 'Checked in! Your time is now being tracked.')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Check-in failed')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCheckOut = async () => {
    if (!proofPhoto) {
      toast.error('Please attach a proof photo before checking out.')
      return
    }
    setActionLoading(true)
    try {
      const completed = await taskSessionsApi.checkOut(session.id, proofNotes, proofPhoto)
      clearInterval(timerRef.current)
      setSession(completed)
      setElapsed(0)
      setShowCheckout(false)
      toast.success(`Checked out! You earned RM ${completed.earnings?.toFixed(2)}`)
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

  const handlePause = async () => {
    setActionLoading(true)
    try {
      const paused = await taskSessionsApi.pause(session.id)
      clearInterval(timerRef.current)
      setSession(paused)
      setElapsed(0)
      toast.info('Task paused. You can resume anytime.')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Pause failed')
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

  const payRate = task?.pay_rate_per_minute ?? 0
  const maxEarnings = payRate * (task?.estimated_duration_minutes ?? 0)
  const currentEarnings = (session?.status === 'completed' || session?.status === 'paused')
    ? session.earnings
    : Math.min((elapsed / 60) * payRate, maxEarnings || Infinity)

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-5">
      {/* Task Header */}
      <div className="card">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Task</p>
        <h1 className="text-xl font-bold text-gray-900">{task?.title}</h1>
        <p className="text-sm text-gray-500 mt-1">📍 {task?.location}</p>
        <p className="text-sm text-primary-600 font-medium mt-1">
          RM {payRate.toFixed(4)}/min &nbsp;·&nbsp; Est. {task?.estimated_duration_minutes} min
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Minimum required: {formatDuration(minimumDurationSeconds)}
        </p>
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
              <p className="text-sm text-gray-400">Check in to begin tracking your time and earnings.</p>
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
          {/* Live earnings ticker */}
          <div className="card bg-green-50 border border-green-200 text-center space-y-2">
            <p className="text-xs text-green-600 uppercase tracking-wide font-semibold">Live Earnings</p>
            <p className="text-4xl font-bold text-green-700">RM {currentEarnings.toFixed(2)}</p>
            <p className="text-sm text-green-600">⏱ {formatDuration(elapsed)} elapsed</p>
            <div className="grid grid-cols-2 gap-3 text-left text-xs text-green-700 bg-white/70 rounded-xl p-3 border border-green-100">
              <div>
                <p className="uppercase tracking-wide text-green-500">Worked so far</p>
                <p className="font-semibold text-sm">{formatDuration(elapsed)}</p>
              </div>
              <div>
                <p className="uppercase tracking-wide text-green-500">Minimum required</p>
                <p className="font-semibold text-sm">{formatDuration(minimumDurationSeconds)}</p>
              </div>
            </div>
            <div className="w-full bg-green-100 rounded-full h-2 mt-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-1000"
                style={{ width: `${Math.min(100, (elapsed / (task.estimated_duration_minutes * 60)) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-green-500">Est. total: RM {(payRate * task.estimated_duration_minutes).toFixed(2)}</p>
          </div>

          {/* Check-out section */}
          {!showCheckout ? (
            <div className="flex gap-3">
              <button
                onClick={handlePause}
                disabled={actionLoading}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                ⏸ Pause
              </button>
              <button
                onClick={() => setShowCheckout(true)}
                disabled={actionLoading}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                🏁 Check Out
              </button>
            </div>
          ) : (
            <div className="card space-y-4">
              <h2 className="font-semibold text-gray-900">Submit Completion Proof</h2>

              {/* Photo upload */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Photo Proof <span className="text-red-500">*</span>
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

              {/* Notes */}
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
                  disabled={actionLoading || !proofPhoto}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
                  title={!proofPhoto ? 'Attach a proof photo to check out' : ''}
                >
                  {actionLoading ? 'Submitting…' : 'Confirm Check Out'}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : session.status === 'paused' ? (
        /* Paused */
        <div className="card text-center space-y-4">
          <p className="text-5xl">⏸</p>
          <h2 className="text-xl font-bold text-gray-900">Task Paused</h2>

          <div className="bg-amber-50 rounded-xl p-4 space-y-2">
            <p className="text-sm text-gray-500">Earnings so far</p>
            <p className="text-3xl font-bold text-amber-700">RM {session.earnings?.toFixed(2)}</p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left space-y-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-amber-600">Worked so far</p>
                <p className="text-sm font-semibold text-amber-800">
                  {formatDuration(Math.floor((parseUTC(session.checked_out_at) - parseUTC(session.checked_in_at)) / 1000))}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-amber-600">Minimum required</p>
                <p className="text-sm font-semibold text-amber-800">{formatDuration(minimumDurationSeconds)}</p>
              </div>
            </div>
            <p className="text-xs text-amber-700 pt-1">Resume to continue tracking from where you stopped.</p>
          </div>

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
        /* Completed */
        <div className="card text-center space-y-4">
          <p className="text-5xl">🎉</p>
          <h2 className="text-xl font-bold text-gray-900">Work Completed!</h2>

          <div className="bg-green-50 rounded-xl p-4 space-y-2">
            <p className="text-sm text-gray-500">Total Earnings</p>
            <p className="text-3xl font-bold text-green-700">RM {session.earnings?.toFixed(2)}</p>
          </div>

          <div className="text-left space-y-2 border-t border-gray-100 pt-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Checked in</span>
              <span className="text-gray-700">{parseUTC(session.checked_in_at).toLocaleTimeString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Checked out</span>
              <span className="text-gray-700">{parseUTC(session.checked_out_at).toLocaleTimeString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Duration</span>
              <span className="text-gray-700">
                {formatDuration(Math.floor((parseUTC(session.checked_out_at) - parseUTC(session.checked_in_at)) / 1000))}
              </span>
            </div>
          </div>

          {session.proof_notes && (
            <div className="bg-gray-50 rounded-lg p-3 text-left">
              <p className="text-xs text-gray-500 mb-1">Your notes</p>
              <p className="text-sm text-gray-700">{session.proof_notes}</p>
            </div>
          )}
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
