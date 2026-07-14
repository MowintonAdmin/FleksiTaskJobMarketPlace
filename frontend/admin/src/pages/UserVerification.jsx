import { useEffect, useState, useCallback } from 'react'
import { useSelector } from 'react-redux'
import { toast } from 'react-toastify'
import api from '../api/client'
import usePolling from '../hooks/usePolling'
import SearchFilterBar from '../components/SearchFilterBar'
import RefreshButton from '../components/RefreshButton'

const REJECTION_REASONS = [
  'ID photo is unclear or blurry',
  'Face does not match ID photo',
  'ID document is expired',
  'Name on ID does not match registration',
  'Suspicious or altered document',
  'Incomplete information provided',
  'Other',
]

export default function UserVerification() {
  const { user } = useSelector((s) => s.auth)
  const isSuperAdmin = user?.is_super_admin

  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [processingId, setProcessingId] = useState(null)
  const [rejectModal, setRejectModal] = useState(null) // user object being rejected
  const [rejectReason, setRejectReason] = useState('')
  const [rejectCustom, setRejectCustom] = useState('')
  const [viewModal, setViewModal] = useState(null) // user object being viewed in detail

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/users/unverified')
      setUsers(data)
      setAccessDenied(false)
    } catch (err) {
      const status = err.response?.status
      if (status === 403) {
        setAccessDenied(true)
      } else {
        toast.error('Failed to load unverified users')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 5s
  usePolling(load, 5000)

  const handleApprove = async (userId) => {
    setProcessingId(userId)
    try {
      await api.post(`/admin/users/${userId}/verify`, { action: 'approve' })
      toast.success('User approved!')
      setUsers(prev => prev.filter(u => u.id !== userId))
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to approve user')
    } finally {
      setProcessingId(null)
    }
  }

  const openRejectModal = (user) => {
    setRejectModal(user)
    setRejectReason('')
    setRejectCustom('')
  }

  const handleReject = async () => {
    const user = rejectModal
    if (!user) return
    const reason = rejectReason === 'Other' ? rejectCustom : rejectReason
    if (!reason) {
      toast.error('Please select or enter a rejection reason')
      return
    }
    setProcessingId(user.id)
    try {
      await api.post(`/admin/users/${user.id}/verify`, { action: 'reject', reason })
      toast.success('User rejected.')
      setUsers(prev => prev.filter(u => u.id !== user.id))
      setRejectModal(null)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to reject user')
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          User Verification <span className="text-gray-400 font-normal text-lg">({users.length})</span>
        </h1>
        <RefreshButton onClick={load} loading={loading} />
      </div>

      {/* Search + Filter */}
      {!accessDenied && (
        <SearchFilterBar
          search={search}
          onSearchChange={setSearch}
          placeholder="Search by name or email…"
          filters={[]}
        />
      )}

      {accessDenied ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔒</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Restricted</h2>
          <p className="text-gray-500 max-w-md mx-auto">
            The User Verification feature is only available to <strong>Super Admin</strong> accounts. 
            Please contact your system administrator if you need to verify user accounts.
          </p>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white rounded-xl p-5 animate-pulse space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/3" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center">
          <p className="text-5xl mb-3">✅</p>
          <p className="font-semibold text-gray-600">No pending verifications</p>
          <p className="text-sm text-gray-400 mt-1">All users have been verified.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {users
            .filter(u => {
              if (!search) return true
              const q = search.toLowerCase()
              return u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
            })
            .map(u => (
            <div key={u.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{u.full_name}</p>
                    <p className="text-sm text-gray-500">{u.email}</p>
                    {u.phone && <p className="text-sm text-gray-500 mt-0.5">📞 {u.phone}</p>}
                    {u.location && <p className="text-sm text-gray-500 mt-0.5">📍 {u.location}</p>}
                    <p className="text-xs text-gray-400 mt-1">Joined: {new Date(u.created_at).toLocaleString()}</p>
                    <p className="text-xs text-gray-400">Sessions: {u.total_sessions || 0} ({u.completed_sessions || 0} completed)</p>
                  </div>
                  <div className="text-right shrink-0">
                    {u.profile_photo_url && (
                      <img src={u.profile_photo_url} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-gray-200" onError={e => { e.currentTarget.style.display = 'none' }} />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1 text-sm">
                  {u.nationality && <p><span className="text-gray-500">Nationality:</span> {u.nationality}</p>}
                  {u.race && <p><span className="text-gray-500">Race:</span> {u.race}</p>}
                  {u.nric_passport && <p><span className="text-gray-500">NRIC/Passport:</span> {u.nric_passport}</p>}
                  {u.body_height_cm && <p><span className="text-gray-500">Height:</span> {u.body_height_cm} cm</p>}
                  {u.academic_qualification && <p><span className="text-gray-500">Education:</span> {u.academic_qualification}</p>}
                </div>

                {/* Identity photos row */}
                <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-100">
                  {u.selfie_with_id_url && (
                    <div className="text-center">
                      <p className="text-xs text-gray-400 mb-1">Selfie with ID</p>
                      <img
                        src={u.selfie_with_id_url}
                        alt="Selfie with ID"
                        className="w-24 h-24 rounded-lg object-cover border border-gray-200 cursor-pointer hover:opacity-80"
                        onClick={() => setViewModal({ ...u, imageUrl: u.selfie_with_id_url, imageLabel: 'Selfie with ID' })}
                        onError={e => { e.currentTarget.style.display = 'none' }}
                      />
                    </div>
                  )}
                  {u.bank_qr_code_url && (
                    <div className="text-center">
                      <p className="text-xs text-gray-400 mb-1">Bank QR</p>
                      <img
                        src={u.bank_qr_code_url}
                        alt="Bank QR"
                        className="w-24 h-24 rounded-lg object-cover border border-gray-200 cursor-pointer hover:opacity-80"
                        onClick={() => setViewModal({ ...u, imageUrl: u.bank_qr_code_url, imageLabel: 'Bank QR Code' })}
                        onError={e => { e.currentTarget.style.display = 'none' }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex border-t border-gray-100">
                <button
                  onClick={() => openRejectModal(u)}
                  disabled={processingId === u.id}
                  className="flex-1 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 border-r border-gray-100"
                >
                  {processingId === u.id ? '⏳' : '✕ Reject'}
                </button>
                <button
                  onClick={() => handleApprove(u.id)}
                  disabled={processingId === u.id}
                  className="flex-1 py-3 text-sm font-semibold text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
                >
                  {processingId === u.id ? '⏳ Approving...' : '✓ Approve User'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Photo view modal */}
      {viewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setViewModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900">{viewModal.imageLabel}</h2>
              <button onClick={() => setViewModal(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <img src={viewModal.imageUrl} alt={viewModal.imageLabel} className="w-full rounded-xl" />
            <p className="text-sm text-gray-500 mt-2">{viewModal.full_name} — {viewModal.email}</p>
          </div>
        </div>
      )}

      {/* Rejection reason modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setRejectModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Reject User</h2>
              <button onClick={() => setRejectModal(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <p className="text-sm text-gray-500">Why are you rejecting <strong>{rejectModal.full_name}</strong>?</p>

            <div className="space-y-2">
              {REJECTION_REASONS.map(r => (
                <label key={r} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="rejectReason"
                    value={r}
                    checked={rejectReason === r}
                    onChange={e => setRejectReason(e.target.value)}
                    className="w-4 h-4 text-red-600"
                  />
                  <span className="text-sm text-gray-700">{r}</span>
                </label>
              ))}
            </div>

            {rejectReason === 'Other' && (
              <textarea
                value={rejectCustom}
                onChange={e => setRejectCustom(e.target.value)}
                placeholder="Describe the reason..."
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-400 focus:outline-none resize-none"
              />
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={() => setRejectModal(null)} className="flex-1 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={processingId || !rejectReason}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {processingId ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}