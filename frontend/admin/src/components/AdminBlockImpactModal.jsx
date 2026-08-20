import { useEffect, useState } from 'react'
import api from '../api/client'
import { toast } from 'react-toastify'

/**
 * Unified Admin Block Impact Pre-Check Confirmation Modal for Super Admin.
 * Pre-checks created projects status, tasks status, and active worker timers
 * before Super Admin confirms blocking a normal Admin user account.
 */
export default function AdminBlockImpactModal({ adminUser, onClose, onBlocked, onUnblocked }) {
  const [impact, setImpact] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const isBlocked = adminUser?.is_blocked

  useEffect(() => {
    if (!adminUser?.id || isBlocked) {
      setLoading(false)
      return
    }
    setLoading(true)
    api
      .get(`/admin/users/admins/${adminUser.id}/block-impact`)
      .then((res) => {
        setImpact(res.data)
      })
      .catch(() => {
        toast.error('Failed to load admin user status details')
      })
      .finally(() => setLoading(false))
  }, [adminUser?.id, isBlocked])

  const handleBlock = async () => {
    setSubmitting(true)
    try {
      await api.post(`/admin/users/admins/${adminUser.id}/block`)
      toast.success(`Admin "${adminUser.full_name}" has been blocked & archived.`)
      onBlocked?.()
      onClose()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to block admin account')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUnblock = async () => {
    setSubmitting(true)
    try {
      await api.post(`/admin/users/admins/${adminUser.id}/unblock`)
      toast.success(`Admin "${adminUser.full_name}" has been unblocked & restored.`)
      onUnblocked?.()
      onClose()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to unblock admin account')
    } finally {
      setSubmitting(false)
    }
  }

  if (isBlocked) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">✅</span>
              <h3 className="font-bold text-gray-900 text-lg">Unblock Admin Account</h3>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-lg">✕</button>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800 space-y-1">
            <p className="font-semibold">{adminUser.full_name}</p>
            <p className="text-xs text-green-600">{adminUser.email}</p>
            <p className="text-xs text-gray-600 mt-2">
              Unblocking this Admin will immediately restore their admin portal login access and allow them to manage projects and tasks again.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50">
              Cancel
            </button>
            <button
              onClick={handleUnblock}
              disabled={submitting}
              className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {submitting ? 'Unblocking...' : 'Restore Admin Access'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛑</span>
            <h3 className="font-bold text-gray-900 text-lg">Block & Archive Admin</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-lg">✕</button>
        </div>

        {/* Target Admin Brief */}
        <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center font-bold text-purple-600 shrink-0">
            {(adminUser.full_name || adminUser.email || '?')[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">{adminUser.full_name}</p>
            <p className="text-xs text-gray-500 truncate">{adminUser.email}</p>
            {adminUser.company_tag && (
              <span className="inline-block mt-0.5 text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-medium border border-purple-100">
                Company: {adminUser.company_tag}
              </span>
            )}
          </div>
        </div>

        {/* Warning Pre-Check Impact List */}
        <div className="space-y-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
            Admin Account Pre-Check Findings
          </p>

          {loading ? (
            <div className="space-y-2 py-4">
              <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
              <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              {/* Projects Created */}
              <div className={`p-3 rounded-xl border ${impact?.active_projects_count > 0 ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-gray-50 border-gray-100 text-gray-700'}`}>
                <div className="flex items-center justify-between font-semibold">
                  <span>📁 Managed Projects</span>
                  <span className={impact?.active_projects_count > 0 ? 'text-blue-700 font-bold' : 'text-gray-500'}>
                    {impact?.active_projects_count ?? 0} active / {impact?.closed_projects_count ?? 0} closed
                  </span>
                </div>
                <p className="mt-1 text-gray-600 leading-snug">
                  Total {impact?.total_projects_count ?? 0} project(s) created. Blocking this admin will freeze login access while keeping 100% of project data, history, and company tags intact.
                </p>
              </div>

              {/* Tasks & Applications */}
              <div className={`p-3 rounded-xl border ${impact?.open_tasks_count > 0 ? 'bg-purple-50 border-purple-200 text-purple-900' : 'bg-gray-50 border-gray-100 text-gray-700'}`}>
                <div className="flex items-center justify-between font-semibold">
                  <span>📋 Associated Tasks</span>
                  <span>
                    {impact?.open_tasks_count ?? 0} open / {impact?.completed_tasks_count ?? 0} completed
                  </span>
                </div>
                <p className="mt-0.5 text-gray-500">
                  {impact?.pending_applications_count ?? 0} worker application(s) currently under this admin's projects.
                </p>
              </div>

              {/* Active Worker Timers */}
              <div className={`p-3 rounded-xl border ${impact?.active_sessions_count > 0 ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-gray-50 border-gray-100 text-gray-700'}`}>
                <div className="flex items-center justify-between font-semibold">
                  <span>⏱ Running Worker Timers</span>
                  <span className={impact?.active_sessions_count > 0 ? 'text-amber-700 font-bold' : 'text-gray-500'}>
                    {impact?.active_sessions_count ?? 0} active
                  </span>
                </div>
                {impact?.active_sessions_count > 0 ? (
                  <p className="mt-1 text-amber-700 leading-snug">
                    {impact.active_sessions_count} worker(s) are currently running work sessions in tasks under this admin's projects.
                  </p>
                ) : (
                  <p className="mt-0.5 text-gray-500">No workers currently checked in under this admin's tasks.</p>
                )}
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-100 font-medium leading-relaxed">
          ⚠️ Are you sure you want to proceed with blocking admin <strong>{adminUser.full_name}</strong>?
        </p>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleBlock}
            disabled={submitting || loading}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {submitting ? 'Blocking...' : 'Yes, Block Admin Account'}
          </button>
        </div>
      </div>
    </div>
  )
}
