import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { applicationsApi, taskSessionsApi } from '../api/tasks'
import usePolling from '../hooks/usePolling'
import api from '../api/client'

const STATUS_STYLES = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
  withdrawn: 'bg-gray-100 text-gray-600',
}

export default function MyApplications() {
  const [applications, setApplications] = useState([])
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchApplications = useCallback(async () => {
    try {
      const [data, sessData] = await Promise.all([
        applicationsApi.getMyApplications(),
        taskSessionsApi.getMySessions().catch(() => []),
      ])
      setApplications(data)
      setSessions(sessData)
      setError(null)
    } catch {
      if (loading) setError('Failed to load applications')
    }
  }, [loading])

  useEffect(() => {
    fetchApplications().finally(() => setLoading(false))
  }, [fetchApplications])

  // Auto-refresh every 5s
  usePolling(fetchApplications, 5000)

  if (loading) return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-3">
      {[1,2,3].map(i => <div key={i} className="card animate-pulse h-24" />)}
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Applications</h1>

      {error && <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg p-3 text-sm mb-4">{error}</div>}

      {applications.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-medium">No applications yet</p>
          <Link to="/" className="text-primary-600 text-sm hover:underline mt-2 inline-block">Browse available tasks →</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => (
            <div key={app.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {app.task ? (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link to={`/tasks/${app.task_id}`} className="font-semibold text-gray-900 hover:text-primary-600 truncate">
                          {app.task.title}
                        </Link>
                        {app.task.status === 'completed' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">✓ Completed</span>
                        )}
                        {app.task.status === 'cancelled' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-400 font-medium">Cancelled</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                        📍 {app.task.location}
                      </p>
                      <p className="text-sm text-primary-600 font-medium mt-1">
                        RM {(app.task.pay_rate_per_minute * app.task.estimated_duration_minutes).toFixed(2)}
                      </p>
                    </>
                  ) : (
                    <p className="text-gray-500 text-sm">Task details unavailable</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full capitalize ${STATUS_STYLES[app.status]}`}>
                    {app.status}
                  </span>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(app.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              {app.cover_note && (
                <p className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100 italic">"{app.cover_note}"</p>
              )}
              {app.status === 'approved' && app.task?.status === 'completed' && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-3">
                    <span className="text-2xl">✅</span>
                    <div>
                      <p className="font-semibold text-green-800 text-sm">Task Completed</p>
                      <p className="text-xs text-green-600">This task has been completed and earnings have been credited to your wallet.</p>
                    </div>
                  </div>
                </div>
              )}
              {(() => {
                // Hide Track Work if a completed/settled session already exists for this application
                const appSession = sessions.find(s => s.application_id === app.id)
                const hasCompletedSession = appSession && (appSession.status === 'completed' || appSession.status === 'settled')
                return app.status === 'approved' && !hasCompletedSession && app.task?.status !== 'completed' && app.task?.status !== 'cancelled'
              })() && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <Link
                    to={`/track/${app.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    ⏱ Track Work
                  </Link>
                </div>
              )}
              {app.task?.status === 'cancelled' && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="font-semibold text-red-800 text-sm">❌ Task Cancelled</p>
                    <p className="text-xs text-red-600">This task has been cancelled by the employer.</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
