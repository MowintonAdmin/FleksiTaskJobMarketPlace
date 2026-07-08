import { useEffect, useState, useCallback } from 'react'
import api from '../api/client'
import { toast } from 'react-toastify'
import SearchFilterBar from '../components/SearchFilterBar'
import RefreshButton from '../components/RefreshButton'

function elapsed(minutes) {
  if (minutes == null) return '—'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

const fmt = (iso) => iso ? new Date(iso).toLocaleString('en-MY', { dateStyle: 'short', timeStyle: 'short' }) : '—'
const fmtInput = (iso) => iso ? new Date(iso).toISOString().slice(0, 16) : ''
const formatStatusLabel = (status) =>
  String(status || '')
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

/* ── Adjust Time Modal ─────────────────────────────────────────────────── */
function AdjustModal({ session, onClose, onSaved }) {
  const [checkedIn, setCheckedIn] = useState(fmtInput(session.checked_in_at))
  const [checkedOut, setCheckedOut] = useState(fmtInput(session.checked_out_at))
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState(null)

  // Calculate preview earnings
  useEffect(() => {
    if (!checkedIn) { setPreview(null); return }
    const inTime = new Date(checkedIn)
    const outTime = checkedOut ? new Date(checkedOut) : null
    if (outTime && outTime > inTime) {
      const mins = (outTime - inTime) / 60000
      setPreview(round2(mins * session.pay_rate_per_minute))
    } else {
      setPreview(null)
    }
  }, [checkedIn, checkedOut, session.pay_rate_per_minute])

  const round2 = (n) => Math.round(n * 100) / 100

  const save = async () => {
    if (!checkedIn) { toast.error('Check-in time is required'); return }
    if (checkedOut && new Date(checkedOut) <= new Date(checkedIn)) {
      toast.error('Check-out must be after check-in'); return
    }
    setSaving(true)
    try {
      await api.patch(`/admin/sessions/${session.session_id}/adjust`, {
        checked_in_at: new Date(checkedIn).toISOString(),
        checked_out_at: checkedOut ? new Date(checkedOut).toISOString() : null,
        reason: reason || null,
      })
      toast.success('Session time adjusted and worker notified')
      onSaved()
      onClose()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Adjustment failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">⏱ Adjust Session Time</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
        </div>

        {/* Context */}
        <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
          <p className="font-semibold text-gray-800">{session.worker_name}</p>
          <p className="text-gray-500">Task: {session.task_title}</p>
          <p className="text-gray-400 text-xs">Rate: RM {session.pay_rate_per_minute}/min · Current earnings: RM {(session.cost ?? 0).toFixed(2)}</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Check-in Time</label>
            <input type="datetime-local" value={checkedIn} onChange={e => setCheckedIn(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Check-out Time <span className="text-gray-400 font-normal">(leave blank for active sessions)</span></label>
            <input type="datetime-local" value={checkedOut} onChange={e => setCheckedOut(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Reason (sent to worker)</label>
            <input value={reason} onChange={e => setReason(e.target.value)}
              placeholder="e.g. Corrected clock error"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none" />
          </div>
        </div>

        {/* Earnings preview */}
        {preview != null && (
          <div className="bg-blue-50 rounded-xl px-4 py-3 flex items-center justify-between text-sm">
            <span className="text-blue-700">New earnings after adjustment</span>
            <span className="font-bold text-blue-800">RM {preview.toFixed(2)}</span>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Apply Adjustment'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Task Cost Summary panel ───────────────────────────────────────────── */
function TaskCostPanel({ costs, loading }) {
  const total = costs.reduce((s, t) => s + t.total_cost, 0)
  const totalPaid = costs.reduce((s, t) => s + t.paid_cost, 0)
  const totalLive = costs.reduce((s, t) => s + t.live_cost, 0)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
      {/* Summary bar */}
      <div className="grid grid-cols-3 divide-x divide-gray-100 bg-gray-50 border-b border-gray-100">
        {[
          { label: 'Total Cost', value: `RM ${total.toFixed(2)}`, color: 'text-gray-900' },
          { label: 'Paid Out', value: `RM ${totalPaid.toFixed(2)}`, color: 'text-green-700' },
          { label: 'Live Accruing', value: `RM ${totalLive.toFixed(2)}`, color: 'text-blue-700' },
        ].map(s => (
          <div key={s.label} className="px-5 py-3 text-center">
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      <table className="w-full text-sm">
        <thead className="text-gray-500 text-xs uppercase border-b border-gray-100 bg-gray-50">
          <tr>
            <th className="px-5 py-3 text-left">Task</th>
            <th className="px-5 py-3 text-center">Status</th>
            <th className="px-5 py-3 text-right">Estimated</th>
            <th className="px-5 py-3 text-right">Paid</th>
            <th className="px-5 py-3 text-right">Live</th>
            <th className="px-5 py-3 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {loading ? [1,2,3].map(i => (
            <tr key={i}>{[1,2,3,4,5,6].map(j => (
              <td key={j} className="px-5 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
            ))}</tr>
          )) : costs.length === 0 ? (
            <tr><td colSpan={6} className="text-center py-10 text-gray-400">No tasks found</td></tr>
          ) : costs.map(t => (
            <tr key={t.task_id} className="hover:bg-gray-50 transition-colors">
              <td className="px-5 py-3">
                <p className="font-medium text-gray-900 truncate max-w-[200px]">{t.task_title}</p>
                <p className="text-xs text-gray-400">RM {t.pay_rate_per_minute}/min · {t.session_count} session{t.session_count !== 1 ? 's' : ''}</p>
              </td>
              <td className="px-5 py-3 text-center">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  t.status === 'open' ? 'bg-green-100 text-green-700' :
                  t.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                  t.status === 'completed' ? 'bg-gray-100 text-gray-600' :
                  'bg-red-100 text-red-500'
                }`}>{formatStatusLabel(t.status)}</span>
              </td>
              <td className="px-5 py-3 text-right text-gray-500">RM {t.estimated_cost.toFixed(2)}</td>
              <td className="px-5 py-3 text-right text-green-700 font-medium">RM {t.paid_cost.toFixed(2)}</td>
              <td className="px-5 py-3 text-right text-blue-600">
                {t.live_cost > 0 ? `RM ${t.live_cost.toFixed(2)}` : '—'}
              </td>
              <td className="px-5 py-3 text-right font-bold text-gray-900">RM {t.total_cost.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ── Main TimeLogs page ────────────────────────────────────────────────── */
export default function TimeLogs() {
  const [logs, setLogs] = useState([])
  const [costs, setCosts] = useState([])
  const [tasks, setTasks] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [loadingCosts, setLoadingCosts] = useState(true)
  const [filterTask, setFilterTask] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [tab, setTab] = useState('logs')     // 'logs' | 'costs'
  const [adjustSession, setAdjustSession] = useState(null)

  const loadLogs = useCallback(() => {
    setLoadingLogs(true)
    const params = {}
    if (filterTask) params.task_id = filterTask
    if (filterStatus) params.status = filterStatus
    api.get('/admin/time-logs', { params })
      .then(r => setLogs(r.data))
      .catch(() => toast.error('Failed to load time logs'))
      .finally(() => setLoadingLogs(false))
  }, [filterTask, filterStatus])

  const loadCosts = useCallback(() => {
    setLoadingCosts(true)
    api.get('/admin/tasks/costs')
      .then(r => setCosts(r.data))
      .catch(() => toast.error('Failed to load task costs'))
      .finally(() => setLoadingCosts(false))
  }, [])

  useEffect(() => {
    api.get('/tasks?page=1&page_size=100').then(r => setTasks(r.data.tasks || [])).catch(() => {})
    loadCosts()
  }, [loadCosts])

  useEffect(() => { loadLogs() }, [loadLogs])

  const totalCost = logs.reduce((s, l) => s + (l.cost ?? 0), 0)
  const activeLogs = logs.filter(l => l.status === 'active')

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">⏱ Time & Payment Monitoring</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {activeLogs.length} worker{activeLogs.length !== 1 ? 's' : ''} active now · Total cost RM {totalCost.toFixed(2)}
          </p>
        </div>
        <RefreshButton onClick={() => { loadLogs(); loadCosts() }} loading={loadingLogs || loadingCosts} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {[['logs', '📋 Time Logs'], ['costs', '💰 Task Costs']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors ${
              tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Time Logs Tab ── */}
      {tab === 'logs' && (
        <>
          {/* Filters */}
          <SearchFilterBar
            search=""
            onSearchChange={() => {}}
            placeholder=""
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
                  { value: 'active', label: 'Active' },
                  { value: 'completed', label: 'Completed' },
                ],
              },
            ]}
          />

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase border-b border-gray-100">
                <tr>
                  <th className="px-5 py-3 text-left">Worker</th>
                  <th className="px-5 py-3 text-left">Task</th>
                  <th className="px-5 py-3 text-left">Check-in</th>
                  <th className="px-5 py-3 text-left">Check-out</th>
                  <th className="px-5 py-3 text-center">Duration</th>
                  <th className="px-5 py-3 text-center">Status</th>
                  <th className="px-5 py-3 text-right">Cost</th>
                  <th className="px-5 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loadingLogs ? (
                  [1,2,3,4].map(i => (
                    <tr key={i}>{[1,2,3,4,5,6,7,8].map(j => (
                      <td key={j} className="px-5 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                    ))}</tr>
                  ))
                ) : logs.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400">No sessions found</td></tr>
                ) : logs.map(log => (
                  <tr key={log.session_id} className={`hover:bg-gray-50 transition-colors ${log.status === 'active' ? 'bg-green-50/40' : ''}`}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{log.worker_name}</p>
                      <p className="text-xs text-gray-400">{log.worker_email}</p>
                    </td>
                    <td className="px-5 py-3 max-w-[160px]">
                      <p className="font-medium text-gray-800 truncate">{log.task_title}</p>
                      <p className="text-xs text-gray-400">{log.task_location}</p>
                    </td>
                    <td className="px-5 py-3 text-gray-600 text-xs">{fmt(log.checked_in_at)}</td>
                    <td className="px-5 py-3 text-gray-600 text-xs">{log.checked_out_at ? fmt(log.checked_out_at) : <span className="text-green-600 font-medium animate-pulse">Active</span>}</td>
                    <td className="px-5 py-3 text-center text-gray-700">{elapsed(log.elapsed_minutes)}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        log.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>{formatStatusLabel(log.status)}</span>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-900">
                      RM {(log.cost ?? 0).toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button onClick={() => setAdjustSession(log)}
                        className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors font-medium">
                        ✏️ Adjust
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              {logs.length > 0 && (
                <tfoot className="bg-gray-50 border-t border-gray-200">
                  <tr>
                    <td colSpan={6} className="px-5 py-3 text-xs text-gray-500 font-semibold uppercase">Total</td>
                    <td className="px-5 py-3 text-right font-bold text-gray-900">
                      RM {logs.reduce((s, l) => s + (l.cost ?? 0), 0).toFixed(2)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}

      {/* ── Task Costs Tab ── */}
      {tab === 'costs' && <TaskCostPanel costs={costs} loading={loadingCosts} />}

      {adjustSession && (
        <AdjustModal
          session={adjustSession}
          onClose={() => setAdjustSession(null)}
          onSaved={() => { loadLogs(); loadCosts() }}
        />
      )}
    </div>
  )
}
