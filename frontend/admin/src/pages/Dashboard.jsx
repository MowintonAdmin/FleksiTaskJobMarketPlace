import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import StatsCard from '../components/StatsCard'
import api from '../api/client'

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [importCount, setImportCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [dashRes, logsRes] = await Promise.all([
        api.get('/admin/analytics/dashboard'),
        api.get('/admin/import/logs'),
      ])
      setData(dashRes.data)
      setImportCount(logsRes.data?.length ?? 0)
    } catch {}
  }, [])

  useEffect(() => { load().finally(() => setLoading(false)) }, [load])

  // Auto-refresh every 30 seconds

  // Auto-refresh dashboard stats every 5s

  const t = data?.tasks
  const r = data?.revenue
  const s = data?.sessions

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <Link
          to="/analytics"
          className="text-sm text-blue-600 hover:underline flex items-center gap-1"
        >
          📈 Full Analytics →
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading metrics…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatsCard label="Total Tasks" value={t?.total ?? '—'} icon="📋" color="green" />
            <StatsCard label="Total Users" value={data?.users?.total ?? '—'} icon="👥" color="blue" />
            <StatsCard label="Applications" value={data?.applications?.total ?? '—'} icon="📝" color="yellow" />
            <StatsCard label="Active Workers" value={s?.active_now ?? '—'} icon="🟢" color="purple" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatsCard label="Total Paid Out" value={r ? `RM ${r.total_paid.toLocaleString()}` : '—'} icon="💰" color="green" />
            <StatsCard label="Today's Spending" value={r ? `RM ${r.today}` : '—'} icon="📅" color="blue" />
            <StatsCard label="Completion Rate" value={t ? `${t.completion_rate}%` : '—'} icon="✅" color="purple" />
            <StatsCard label="Pending Withdrawals" value={data?.withdrawals?.pending ?? '—'} icon="💸" color="yellow" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard label="Total Sessions" value={s?.total?.toLocaleString() ?? '—'} icon="🚀" color="indigo" />
            <StatsCard label="Completed Sessions" value={s?.completed?.toLocaleString() ?? '—'} icon="🏁" color="indigo" />
            <StatsCard label="Avg Rating" value={data?.rating?.average ? `⭐ ${data.rating.average}` : '—'} icon="🌟" color="yellow" />
            <StatsCard label="Import Logs" value={importCount} icon="📥" color="indigo" />
          </div>
        </>
      )}
    </div>
  )
}
