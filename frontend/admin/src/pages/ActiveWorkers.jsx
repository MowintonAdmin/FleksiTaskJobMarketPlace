import { useEffect, useState, useCallback } from 'react'
import { useAutoRefresh } from '../utils/useAutoRefresh'
import api from '../api/client'
import { toast } from 'react-toastify'
import SearchFilterBar from '../components/SearchFilterBar'
import RefreshButton from '../components/RefreshButton'

function elapsed(minutes) {
  const h = Math.floor(minutes / 60)
  const m = Math.floor(minutes % 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function ConfirmModal({ worker, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Force Stop Session?</h2>
        <p className="text-sm text-gray-600">
          This will immediately end <span className="font-semibold">{worker.worker_name || worker.worker_email}</span>'s
          active session on <span className="font-semibold">"{worker.task_title}"</span>.
          They will be credited for <span className="font-semibold">{elapsed(worker.elapsed_minutes)}</span> of work
          (≈ RM {worker.current_earnings.toFixed(2)}) and notified via message.
        </p>
        <div className="flex gap-3 pt-1">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50"
          >
            {loading ? 'Stopping…' : '⏹ Force Stop'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ActiveWorkers() {
  const [workers, setWorkers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [stopping, setStopping] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/workers/active')
      setWorkers(data)
      setLastRefresh(new Date())
    } catch {
      toast.error('Failed to load active workers')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load + auto-refresh every 30 seconds
  useEffect(() => {
    load()
    const interval = setInterval(load, 30_000)
    return () => clearInterval(interval)
  }, [load])

  const handleForceStop = async () => {
    if (!confirmTarget) return
    setStopping(true)
    try {
      const { data } = await api.post(`/admin/sessions/${confirmTarget.session_id}/force-stop`)
      toast.success('Session stopped successfully.')
      setConfirmTarget(null)
      await load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to force stop session')
    } finally {
      setStopping(false)
    }
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse inline-block"></span>
            Active Workers
          </h1>
          {lastRefresh && (
            <p className="text-xs text-gray-400 mt-0.5">
              Auto-refreshes every 30s
            </p>
          )}
        </div>
        <RefreshButton onClick={load} loading={loading} lastRefresh={lastRefresh} />
      </div>

      {/* Search */}
      <SearchFilterBar
        search={search}
        onSearchChange={setSearch}
        placeholder="Search by worker name, email or task…"
        filters={[]}
      />

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 space-y-3 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
              <div className="h-3 bg-gray-100 rounded" />
              <div className="h-3 bg-gray-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : workers.length === 0 ? (
        <div className="bg-white rounded-xl p-16 text-center shadow-sm border border-gray-100">
          <p className="text-5xl mb-4">😴</p>
          <p className="font-semibold text-gray-500 text-lg">No workers active right now</p>
          <p className="text-sm text-gray-400 mt-1">Workers who have checked in will appear here</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {workers
            .filter(w => {
              if (!search) return true
              const q = search.toLowerCase()
              return w.worker_name?.toLowerCase().includes(q) ||
                     w.worker_email?.toLowerCase().includes(q) ||
                     w.task_title?.toLowerCase().includes(q)
            })
            .map(w => (
            <div key={w.session_id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              {/* Worker info */}
              <div className="flex items-center gap-3 mb-4">
                {w.worker_photo
                  ? <img src={w.worker_photo} alt="" referrerPolicy="no-referrer" className="w-12 h-12 rounded-full object-cover" />
                  : <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-xl font-bold text-green-600">
                      {(w.worker_name || w.worker_email || '?')[0].toUpperCase()}
                    </div>
                }
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 truncate">{w.worker_name || '—'}</p>
                  <p className="text-xs text-gray-400 truncate">{w.worker_email}</p>
                </div>
                <span className="ml-auto flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full font-medium shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                  Live
                </span>
              </div>

              {/* Task info */}
              <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm space-y-1">
                <p className="font-medium text-gray-800 truncate">📋 {w.task_title}</p>
                {w.task_location && <p className="text-xs text-gray-500">📍 {w.task_location}</p>}
              </div>

              {/* Metrics */}
              <div className="mb-4">
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-green-600">RM {w.current_earnings.toFixed(2)}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Pending amount</p>
                </div>
              </div>

              {/* Check-in time */}
              <p className="text-xs text-gray-400 text-center mb-3">
                Checked in at {new Date(w.checked_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>

              {/* Force Stop */}
              <button
                onClick={() => setConfirmTarget(w)}
                className="w-full py-2 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
              >
                ⏹ Force Stop Session
              </button>
            </div>
          ))}
        </div>
      )}

      {confirmTarget && (
        <ConfirmModal
          worker={confirmTarget}
          onConfirm={handleForceStop}
          onCancel={() => setConfirmTarget(null)}
          loading={stopping}
        />
      )}
    </div>
  )
}