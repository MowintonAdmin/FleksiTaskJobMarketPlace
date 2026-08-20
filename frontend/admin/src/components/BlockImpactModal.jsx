import { useEffect, useState } from 'react'
import api from '../api/client'
import { toast } from 'react-toastify'

/**
 * Unified Block Impact Pre-Check Confirmation Modal for Super Admin.
 * Displays warning details (active sessions, pending/approved applications, wallet balance)
 * before Super Admin confirms blocking a worker.
 */
export default function BlockImpactModal({ worker, onClose, onBlocked, onUnblocked }) {
  const [impact, setImpact] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const isBlocked = worker?.is_blocked

  useEffect(() => {
    if (!worker?.id || isBlocked) {
      setLoading(false)
      return
    }
    setLoading(true)
    api
      .get(`/admin/users/${worker.id}/block-impact`)
      .then((res) => {
        setImpact(res.data)
      })
      .catch(() => {
        toast.error('Failed to load worker status details')
      })
      .finally(() => setLoading(false))
  }, [worker?.id, isBlocked])

  const handleBlock = async () => {
    setSubmitting(true)
    try {
      await api.post(`/admin/users/${worker.id}/block`)
      toast.success(`Worker "${worker.full_name}" has been blocked & archived.`)
      onBlocked?.()
      onClose()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to block worker account')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUnblock = async () => {
    setSubmitting(true)
    try {
      await api.post(`/admin/users/${worker.id}/unblock`)
      toast.success(`Worker "${worker.full_name}" has been unblocked & restored.`)
      onUnblocked?.()
      onClose()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to unblock worker account')
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
              <h3 className="font-bold text-gray-900 text-lg">Unblock Worker Account</h3>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-lg">✕</button>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800 space-y-1">
            <p className="font-semibold">{worker.full_name}</p>
            <p className="text-xs text-green-600">{worker.email}</p>
            <p className="text-xs text-gray-600 mt-2">
              Unblocking this worker will immediately restore their account login access and allow them to apply for tasks again.
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
              {submitting ? 'Unblocking...' : 'Restore Access'}
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
            <h3 className="font-bold text-gray-900 text-lg">Block & Archive Worker</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-lg">✕</button>
        </div>

        {/* Target Worker Brief */}
        <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100 flex items-center gap-3">
          {worker.profile_photo_url ? (
            <img src={worker.profile_photo_url} alt="" referrerPolicy="no-referrer" className="w-10 h-10 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600 shrink-0">
              {worker.full_name?.[0] ?? '?'}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-sm truncate">{worker.full_name}</p>
            <p className="text-xs text-gray-500 truncate">{worker.email}</p>
          </div>
        </div>

        {/* Warning Pre-Check Impact List */}
        <div className="space-y-3">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
            Account Status Pre-Check Findings
          </p>

          {loading ? (
            <div className="space-y-2 py-4">
              <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
              <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              {/* Active Sessions */}
              <div className={`p-3 rounded-xl border ${impact?.active_sessions?.length > 0 ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-gray-50 border-gray-100 text-gray-700'}`}>
                <div className="flex items-center justify-between font-semibold">
                  <span>⏱ Active Work Sessions</span>
                  <span className={impact?.active_sessions?.length > 0 ? 'text-amber-700 font-bold' : 'text-gray-500'}>
                    {impact?.active_sessions?.length ?? 0} active
                  </span>
                </div>
                {impact?.active_sessions?.length > 0 ? (
                  <p className="mt-1 text-amber-700 leading-snug">
                    Worker is currently checked in to: <strong>{impact.active_sessions.map(s => s.task_title).join(', ')}</strong>. Blocking will force checkout & calculate settled earnings.
                  </p>
                ) : (
                  <p className="mt-0.5 text-gray-500">No active work timers currently running.</p>
                )}
              </div>

              {/* Applications & Capacity */}
              <div className={`p-3 rounded-xl border ${(impact?.pending_applications_count > 0 || impact?.approved_applications_count > 0) ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-gray-50 border-gray-100 text-gray-700'}`}>
                <div className="flex items-center justify-between font-semibold">
                  <span>📋 Task Applications</span>
                  <span>
                    {impact?.pending_applications_count ?? 0} pending / {impact?.approved_applications_count ?? 0} approved
                  </span>
                </div>
                {(impact?.pending_applications_count > 0 || impact?.approved_applications_count > 0) ? (
                  <p className="mt-1 text-blue-700 leading-snug">
                    Blocking will withdraw {impact.pending_applications_count} pending application(s) and cancel {impact.approved_applications_count} approved spot(s), returning capacity (-1 count) to task pool.
                  </p>
                ) : (
                  <p className="mt-0.5 text-gray-500">No pending or approved task applications.</p>
                )}
              </div>

              {/* Wallet & Pending Withdrawals */}
              <div className={`p-3 rounded-xl border ${impact?.pending_withdrawals_count > 0 ? 'bg-purple-50 border-purple-200 text-purple-900' : 'bg-gray-50 border-gray-100 text-gray-700'}`}>
                <div className="flex items-center justify-between font-semibold">
                  <span>💰 Wallet & Payouts</span>
                  <span>RM {(impact?.wallet_available_balance ?? 0).toFixed(2)} available</span>
                </div>
                {impact?.pending_withdrawals_count > 0 ? (
                  <p className="mt-1 text-purple-700 leading-snug">
                    Worker has {impact.pending_withdrawals_count} pending withdrawal of RM {impact.pending_withdrawals_amount.toFixed(2)}. It will be retained in Withdrawals list with a Blocked Warning Badge for your approval or rejection.
                  </p>
                ) : (
                  <p className="mt-0.5 text-gray-500">No pending withdrawal requests. Available balance will be locked from new requests.</p>
                )}
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-100 font-medium leading-relaxed">
          ⚠️ Are you sure you want to proceed with blocking <strong>{worker.full_name}</strong>?
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
            {submitting ? 'Blocking...' : 'Yes, Block Account'}
          </button>
        </div>
      </div>
    </div>
  )
}
