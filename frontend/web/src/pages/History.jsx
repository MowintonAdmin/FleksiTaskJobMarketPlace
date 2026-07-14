import { useEffect, useState, useCallback } from 'react'
import api, { apiHost } from '../api/client'
import { toast } from 'react-toastify'
import usePolling from '../hooks/usePolling'

const mediaUrl = (path) => (path ? `${apiHost}${path}` : null)

function Stars({ rating, size = 'text-base' }) {
  if (rating == null) return <span className="text-xs text-gray-400 italic">Not rated</span>
  return (
    <span className={size}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={i <= Math.round(rating) ? 'text-amber-400' : 'text-gray-300'}>★</span>
      ))}
      <span className="text-xs text-gray-500 ml-1">{rating.toFixed(1)}</span>
    </span>
  )
}

function elapsed(minutes) {
  if (minutes == null) return '—'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function History() {
  const [history, setHistory] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [h, s] = await Promise.all([
        api.get('/task-sessions/history'),
        api.get('/task-sessions/stats'),
      ])
      setHistory(h.data)
      setStats(s.data)
    } catch {
      toast.error('Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 10s to sync with session approval
  usePolling(load, 10000)

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-4 animate-pulse">
        <div className="h-32 bg-gray-200 rounded-2xl" />
        <div className="h-10 bg-gray-200 rounded-xl" />
        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}
      </div>
    )
  }

  const monthName = new Date().toLocaleString('default', { month: 'long', year: 'numeric' })

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">📊 My Performance</h1>

      {/* ── Monthly Stats ─────────────────────────────────────────────── */}
      {stats && (
        <div className="space-y-3">
          {/* This Month */}
          <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-2xl p-5 text-white shadow-md">
            <p className="text-xs font-medium text-primary-200 mb-3">{monthName}</p>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-3xl font-bold">{stats.this_month.hours}</p>
                <p className="text-xs text-primary-200 mt-0.5">Hours worked</p>
              </div>
              <div className="text-center border-x border-primary-500">
                <p className="text-3xl font-bold">{stats.this_month.sessions}</p>
                <p className="text-xs text-primary-200 mt-0.5">Tasks done</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">RM {stats.this_month.earnings.toFixed(2)}</p>
                <p className="text-xs text-primary-200 mt-0.5">Earned</p>
              </div>
            </div>
          </div>

          {/* All-time + Rating */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">All Time</p>
              <p className="text-2xl font-bold text-gray-900">{stats.all_time.hours}h</p>
              <p className="text-sm text-gray-500">{stats.all_time.sessions} tasks · RM {stats.all_time.earnings.toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Performance Rating</p>
              {stats.rating.average != null ? (
                <>
                  <div className="flex items-center gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <span key={i} className={`text-2xl ${i <= Math.round(stats.rating.average) ? 'text-amber-400' : 'text-gray-200'}`}>★</span>
                    ))}
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{stats.rating.average.toFixed(1)}<span className="text-sm font-normal text-gray-400"> / 5</span></p>
                  <p className="text-xs text-gray-400">{stats.rating.count} rated session{stats.rating.count !== 1 ? 's' : ''}</p>
                </>
              ) : (
                <div className="flex flex-col justify-center h-14">
                  <p className="text-3xl mb-1">⭐</p>
                  <p className="text-sm text-gray-400">No ratings yet</p>
                  <p className="text-xs text-gray-300">Complete tasks to receive ratings</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Completed Tasks History ───────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-3">
          Completed Tasks <span className="text-gray-400 font-normal text-base">({history.length})</span>
        </h2>

        {history.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-14 text-center shadow-sm">
            <p className="text-4xl mb-3">📋</p>
            <p className="font-semibold text-gray-500">No completed tasks yet</p>
            <p className="text-sm text-gray-400 mt-1">Complete your first task to see it here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map(s => (
              <div key={s.session_id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="flex">
                  {/* Task thumbnail */}
                  {s.task_photo_url ? (
                    <img src={mediaUrl(s.task_photo_url)} alt="" className="w-20 h-20 object-cover shrink-0" />
                  ) : (
                    <div className="w-20 h-20 bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center text-3xl shrink-0">
                      📋
                    </div>
                  )}
                  <div className="flex-1 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{s.task_title}</p>
                        {s.task_location && <p className="text-xs text-gray-400 mt-0.5">📍 {s.task_location}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-green-600">RM {(s.earnings ?? 0).toFixed(2)}</p>
                        <p className="text-xs text-gray-400">{elapsed(s.elapsed_minutes)}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-gray-400">
                        {s.checked_out_at ? new Date(s.checked_out_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </p>
                      <Stars rating={s.rating} />
                    </div>

                    {s.feedback && (
                      <p className="text-xs text-gray-500 bg-amber-50 rounded-lg px-2 py-1 mt-2 italic">
                        "{s.feedback}"
                      </p>
                    )}
                  </div>
                </div>

                {s.proof_notes && (
                  <div className="border-t border-gray-50 px-4 py-2 flex items-start gap-2">
                    <span className="text-xs text-gray-400 shrink-0 mt-0.5">Your notes:</span>
                    <p className="text-xs text-gray-600 italic truncate">{s.proof_notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
