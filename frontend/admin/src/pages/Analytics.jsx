import { useEffect, useState, useCallback } from 'react'
import api, { apiBaseUrl } from '../api/client'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function Card({ label, value, sub, icon, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    green: 'bg-green-50 text-green-600 border-green-100',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    red: 'bg-red-50 text-red-600 border-red-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  }
  return (
    <div className={`rounded-xl border p-5 flex gap-4 items-start ${colors[color]}`}>
      <span className="text-3xl">{icon}</span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</p>
        <p className="text-2xl font-bold mt-0.5">{value ?? '—'}</p>
        {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function BarChart({ data, maxVal }) {
  if (!data.length) return null
  const max = maxVal || Math.max(...data.map((d) => d.value), 1)
  return (
    <div className="flex items-end gap-1 h-32">
      {data.map((d) => {
        const pct = Math.max((d.value / max) * 100, d.value > 0 ? 4 : 0)
        return (
          <div key={d.label} className="flex flex-col items-center gap-1 flex-1 min-w-0">
            <span className="text-[10px] text-gray-500 leading-none">
              {d.value > 0 ? (d.display || d.value) : ''}
            </span>
            <div
              className="w-full rounded-t bg-blue-500 transition-all duration-500"
              style={{ height: `${pct}%` }}
              title={`${d.label}: ${d.display || d.value}`}
            />
            <span className="text-[10px] text-gray-500 truncate w-full text-center leading-none">
              {d.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Tab: Overview ────────────────────────────────────────────────────────────
function OverviewTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/admin/analytics/dashboard')
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-gray-400 p-8 text-center">Loading…</p>
  if (!data) return <p className="text-red-500 p-4">Failed to load dashboard metrics.</p>

  const { users, tasks, applications, sessions, revenue, withdrawals, rating } = data

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <Card label="Total Users" value={users.total} icon="👥" color="blue" />
        <Card label="Total Tasks" value={tasks.total} icon="📋" color="green"
          sub={`${tasks.open} open • ${tasks.completed} done`} />
        <Card label="Applications" value={applications.total} icon="📝" color="yellow"
          sub={`${applications.pending} pending`} />
        <Card label="Active Now" value={sessions.active_now} icon="🟢" color="purple" />
        <Card label="Total Paid Out" value={`RM ${revenue.total_paid.toLocaleString()}`}
          icon="💰" color="green" sub={`RM ${revenue.today} today`} />
        <Card label="Live Accruing" value={`RM ${revenue.live_accruing}`} icon="⏳" color="indigo" />
        <Card label="Completion Rate" value={`${tasks.completion_rate}%`} icon="✅" color="blue" />
        <Card label="Pending Withdrawals" value={withdrawals.pending} icon="💸" color="red" />
      </div>

      {rating.average && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-6">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Avg Worker Rating</p>
            <p className="text-4xl font-bold text-yellow-500 mt-1">
              {'★'.repeat(Math.round(rating.average))}
              <span className="text-lg text-gray-600 ml-2">{rating.average} / 5</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">Based on {rating.count} rated sessions</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="font-semibold text-gray-700 mb-4">Tasks Breakdown</p>
          <div className="space-y-2">
            {[
              { label: 'Open', val: tasks.open, color: 'bg-blue-500' },
              { label: 'Completed', val: tasks.completed, color: 'bg-green-500' },
              { label: 'Cancelled', val: tasks.cancelled, color: 'bg-red-400' },
            ].map(({ label, val, color }) => (
              <div key={label}>
                <div className="flex justify-between text-sm text-gray-600 mb-0.5">
                  <span>{label}</span><span>{val}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`${color} h-2 rounded-full`}
                    style={{ width: `${tasks.total ? (val / tasks.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="font-semibold text-gray-700 mb-4">Applications Breakdown</p>
          <div className="space-y-2">
            {[
              { label: 'Pending', val: applications.pending, color: 'bg-yellow-400' },
              { label: 'Approved', val: applications.approved, color: 'bg-green-500' },
            ].map(({ label, val, color }) => (
              <div key={label}>
                <div className="flex justify-between text-sm text-gray-600 mb-0.5">
                  <span>{label}</span><span>{val}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`${color} h-2 rounded-full`}
                    style={{ width: `${applications.total ? (val / applications.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Tab: Monthly Report ───────────────────────────────────────────────────────
function MonthlyTab() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback((y) => {
    setLoading(true)
    api.get(`/admin/analytics/monthly?year=${y}`)
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(year) }, [year, load])

  const months = data?.months || []
  const totalSpending = months.reduce((a, m) => a + m.spending, 0)
  const totalHours = months.reduce((a, m) => a + m.hours, 0)
  const totalSessions = months.reduce((a, m) => a + m.sessions, 0)

  const chartData = months.map((m) => ({
    label: m.month_name,
    value: m.spending,
    display: `RM ${m.spending}`,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-gray-600">Year</label>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white"
        >
          {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-gray-400 text-center py-12">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Card label="Total Spending" value={`RM ${totalSpending.toLocaleString()}`}
              icon="💰" color="green" />
            <Card label="Total Sessions" value={totalSessions} icon="🔖" color="blue" />
            <Card label="Total Hours Worked" value={`${totalHours.toLocaleString()} h`}
              icon="⏰" color="purple" />
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="font-semibold text-gray-700 mb-4">Monthly Spending (RM) — {year}</p>
            <BarChart data={chartData} />
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  {['Month', 'Sessions', 'Hours', 'Spending (RM)'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {months.map((m) => (
                  <tr key={m.month} className={m.month === new Date().getMonth() + 1 && year === currentYear ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3 font-medium text-gray-800">{m.month_name} {m.year}</td>
                    <td className="px-4 py-3 text-gray-600">{m.sessions}</td>
                    <td className="px-4 py-3 text-gray-600">{m.hours}</td>
                    <td className="px-4 py-3 font-semibold text-green-600">RM {m.spending.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

// ── Tab: Task Completion ──────────────────────────────────────────────────────
function CompletionTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/admin/analytics/task-completion')
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-gray-400 p-8 text-center">Loading…</p>
  if (!data) return <p className="text-red-500 p-4">Failed to load.</p>

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-6">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Overall Completion Rate</p>
          <p className="text-5xl font-bold text-green-600 mt-1">{data.overall_rate}%</p>
        </div>
        <div className="flex-1">
          <div className="w-full bg-gray-100 rounded-full h-4">
            <div
              className="bg-green-500 h-4 rounded-full transition-all duration-700"
              style={{ width: `${data.overall_rate}%` }}
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="font-semibold text-gray-700">By Category</p>
        </div>
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
            <tr>
              {['Category', 'Total', 'Completed', 'Cancelled', 'Open', 'Completion Rate'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {data.by_category.map((row) => (
              <tr key={row.category} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{row.category}</td>
                <td className="px-4 py-3 text-gray-600">{row.total}</td>
                <td className="px-4 py-3 text-green-600 font-medium">{row.completed}</td>
                <td className="px-4 py-3 text-red-500">{row.cancelled}</td>
                <td className="px-4 py-3 text-blue-500">{row.open}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${row.completion_rate}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-gray-600 w-10 text-right">
                      {row.completion_rate}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Tab: Export ───────────────────────────────────────────────────────────────
function ExportTab() {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      const token = JSON.parse(localStorage.getItem('adminToken') || 'null')
      const res = await fetch(`${apiBaseUrl}/admin/analytics/export/workers`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Export failed')
      const disposition = res.headers.get('Content-Disposition') || ''
      const match = disposition.match(/filename=([^;]+)/)
      const filename = match ? match[1] : 'workers.csv'
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Export failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h3 className="font-semibold text-gray-800 text-lg mb-1">Export Worker Data</h3>
        <p className="text-sm text-gray-500 mb-6">
          Download a CSV file containing all registered workers with their session history,
          total earnings, average rating, and verification status. Opens directly in Excel.
        </p>
        <div className="space-y-2 text-sm text-gray-600 mb-6">
          {[
            'Full Name & Email',
            'Location',
            'Date Joined',
            'Total Sessions Completed',
            'Total Hours Worked',
            'Total Earnings (RM)',
            'Average Rating',
            'Verified Status',
          ].map((item) => (
            <div key={item} className="flex items-center gap-2">
              <span className="text-green-500">✓</span> {item}
            </div>
          ))}
        </div>
        <button
          onClick={handleExport}
          disabled={loading}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
        >
          {loading ? (
            <><span className="animate-spin">⏳</span> Generating…</>
          ) : (
            <><span>📥</span> Download CSV</>
          )}
        </button>
      </div>
    </div>
  )
}

// ── Main Analytics Page ───────────────────────────────────────────────────────
const TABS = [
  { id: 'overview', label: '📊 Overview' },
  { id: 'monthly', label: '📅 Monthly Report' },
  { id: 'completion', label: '✅ Task Completion' },
  { id: 'export', label: '📥 Export Data' },
]

export default function Analytics() {
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reporting & Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">Platform performance, spending reports, and data exports</p>
      </div>

      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === t.id
                ? 'bg-white border border-b-white border-gray-200 -mb-px text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'monthly' && <MonthlyTab />}
      {activeTab === 'completion' && <CompletionTab />}
      {activeTab === 'export' && <ExportTab />}
    </div>
  )
}
