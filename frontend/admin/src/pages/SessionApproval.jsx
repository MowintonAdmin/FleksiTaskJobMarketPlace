import { useEffect, useState, useCallback } from 'react'
import { toast } from 'react-toastify'
import api from '../api/client'

import RefreshButton from '../components/RefreshButton'

export default function SessionApproval() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState(null)
  const [notes, setNotes] = useState({})
  const [previewImage, setPreviewImage] = useState(null)
  const [ratings, setRatings] = useState({})
  const [feedbacks, setFeedbacks] = useState({})
  const [ratingErrors, setRatingErrors] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/sessions/pending-approval')
      setSessions(data)
    } catch {
      toast.error('Failed to load pending sessions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 30s — pauses while admin is active
  // Real-time updates via WebSocket

  const handleApprove = async (sessionId) => {
    const rating = ratings[sessionId]
    if (!rating || rating < 1) {
      setRatingErrors(prev => ({ ...prev, [sessionId]: 'Please give a rating (1–5) before approving.' }))
      return
    }
    setProcessingId(sessionId)
    try {
      await api.post(`/admin/sessions/${sessionId}/approve`, {
        rating,
        feedback: feedbacks[sessionId] || null,
        notes: notes[sessionId] || null,
      })
      toast.success('Session approved and payment credited!')
      setSessions(prev => prev.filter(s => s.session_id !== sessionId))
    } catch (e) {
      const msg = e.response?.data?.detail || 'Approval failed'
      toast.error(msg)
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (sessionId) => {
    setProcessingId(sessionId)
    try {
      await api.post(`/admin/sessions/${sessionId}/reject`, {
        notes: notes[sessionId] || null,
      })
      toast.success('Session rejected (earnings = 0)')
      setSessions(prev => prev.filter(s => s.session_id !== sessionId))
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Rejection failed')
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Session Approval <span className="text-gray-400 font-normal text-lg">({sessions.length} pending)</span>
        </h1>
        <RefreshButton onClick={load} loading={loading} />
      </div>

      {loading && sessions.length === 0 ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white rounded-xl p-5 animate-pulse space-y-3">
              <div className="h-4 bg-gray-200 rounded w-1/3" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
              <div className="h-12 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center">
          <p className="text-5xl mb-3">✅</p>
          <p className="font-semibold text-gray-600">No sessions pending approval</p>
          <p className="text-sm text-gray-400 mt-1">Worker check-ins that require your approval will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map(s => (
            <div key={s.session_id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-gray-900">{s.worker_name}</p>
                    <p className="text-sm text-gray-500">{s.worker_email}</p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${s.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                    {s.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Task</p>
                    <p className="font-medium text-gray-900 truncate">{s.task_title}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Duration</p>
                    <p className="font-medium text-gray-900">{s.duration_minutes ? `${s.duration_minutes} min` : '—'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Earnings</p>
                    <p className="font-medium text-gray-900">RM {s.earnings?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Checked in</p>
                    <p className="font-medium text-gray-900 text-xs">{new Date(s.checked_in_at).toLocaleString()}</p>
                  </div>
                </div>

                {/* Identity photos */}
                <div className="grid grid-cols-3 gap-2">
                  {s.worker_bank_qr_url && (
                    <div className="text-center">
                      <p className="text-[10px] text-gray-400 mb-1">🏦 Bank QR</p>
                      <img src={s.worker_bank_qr_url} alt="Bank QR" className="w-full rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setPreviewImage(s.worker_bank_qr_url)} style={{ maxHeight: '120px', objectFit: 'contain' }} />
                    </div>
                  )}
                  {s.worker_id_photo_front_url && (
                    <div className="text-center">
                      <p className="text-[10px] text-gray-400 mb-1">🆔 ID Photo</p>
                      <img src={s.worker_id_photo_front_url} alt="ID Front" className="w-full rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setPreviewImage(s.worker_id_photo_front_url)} style={{ maxHeight: '120px', objectFit: 'contain' }} />
                    </div>
                  )}
                  {s.worker_selfie_url && (
                    <div className="text-center">
                      <p className="text-[10px] text-gray-400 mb-1">🤳 Selfie with ID</p>
                      <img src={s.worker_selfie_url} alt="Selfie" className="w-full rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setPreviewImage(s.worker_selfie_url)} style={{ maxHeight: '120px', objectFit: 'contain' }} />
                    </div>
                  )}
                </div>

                {/* Rating and Feedback */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      ⭐ Rating <span className="text-red-500">*required</span>
                    </label>
                    <div className="flex items-center gap-1 mb-2">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => {
                            setRatings(prev => ({ ...prev, [s.session_id]: star }))
                            setRatingErrors(prev => ({ ...prev, [s.session_id]: null }))
                          }}
                          className={`text-2xl transition-transform hover:scale-125 ${
                            (ratings[s.session_id] || 0) >= star ? 'text-amber-400' : 'text-gray-200'
                          }`}
                        >
                          ★
                        </button>
                      ))}
                      {ratings[s.session_id] && (
                        <span className="text-sm text-gray-500 ml-2">
                          {ratings[s.session_id]} / 5
                        </span>
                      )}
                    </div>
                    {ratingErrors[s.session_id] && <p className="text-xs text-red-500 mb-2">{ratingErrors[s.session_id]}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Feedback <span className="text-gray-400">(optional)</span></label>
                    <textarea
                      rows={2}
                      value={feedbacks[s.session_id] || ''}
                      onChange={(e) => setFeedbacks(prev => ({ ...prev, [s.session_id]: e.target.value }))}
                      placeholder="e.g. Great work! Completed on time and followed instructions."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Admin notes (optional)</label>
                  <input
                    type="text"
                    value={notes[s.session_id] || ''}
                    onChange={(e) => setNotes(prev => ({ ...prev, [s.session_id]: e.target.value }))}
                    placeholder="Add an internal note..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex border-t border-gray-100">
                <button
                  onClick={() => handleReject(s.session_id)}
                  disabled={processingId === s.session_id}
                  className="flex-1 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 border-r border-gray-100"
                >
                  {processingId === s.session_id ? '⏳' : '✕ Reject'}
                </button>
                <button
                  onClick={() => handleApprove(s.session_id)}
                  disabled={processingId === s.session_id}
                  className="flex-1 py-3 text-sm font-semibold text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
                >
                  {processingId === s.session_id ? '⏳ Approving...' : '✓ Approve & Credit'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-2xl w-full max-h-[90vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPreviewImage(null)} className="absolute -top-10 right-0 text-white hover:text-gray-300 text-2xl font-bold z-10">
              ✕ Close
            </button>
            <img src={previewImage} alt="Preview" className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain" />
          </div>
        </div>
      )}
    </div>
  )
}
