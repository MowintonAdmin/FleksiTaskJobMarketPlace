import { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import api from '../api/client'

export default function UserVerification() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/admin/users/unverified')
      setUsers(data)
    } catch {
      toast.error('Failed to load unverified users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

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

  const handleReject = async (userId) => {
    if (!window.confirm('Reject this user? Their account will be permanently deleted.')) return
    setProcessingId(userId)
    try {
      await api.post(`/admin/users/${userId}/verify`, { action: 'reject' })
      toast.success('User rejected and removed.')
      setUsers(prev => prev.filter(u => u.id !== userId))
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
        <button onClick={load} disabled={loading} className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700">
          {loading ? '⟳ Refreshing...' : '⟳ Refresh'}
        </button>
      </div>

      {loading ? (
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
          {users.map(u => (
            <div key={u.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{u.full_name}</p>
                    <p className="text-sm text-gray-500">{u.email}</p>
                    {u.location && <p className="text-sm text-gray-500 mt-0.5">📍 {u.location}</p>}
                    <p className="text-xs text-gray-400 mt-1">Joined: {new Date(u.created_at).toLocaleString()}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {u.profile_photo_url && (
                      <img src={u.profile_photo_url} alt="" className="w-12 h-12 rounded-full object-cover border border-gray-200" onError={e => { e.currentTarget.style.display = 'none' }} />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  {u.nationality && <p><span className="text-gray-500">Nationality:</span> {u.nationality}</p>}
                  {u.race && <p><span className="text-gray-500">Race:</span> {u.race}</p>}
                  {u.nric_passport && <p><span className="text-gray-500">NRIC/Passport:</span> {u.nric_passport}</p>}
                  {u.academic_qualification && <p><span className="text-gray-500">Qualification:</span> {u.academic_qualification}</p>}
                  {u.body_height_cm && <p><span className="text-gray-500">Height:</span> {u.body_height_cm} cm</p>}
                </div>

                {u.bank_qr_code_url && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Bank QR Code:</p>
                    <img src={u.bank_qr_code_url} alt="Bank QR" className="w-24 h-24 rounded-lg object-cover border border-gray-200" onError={e => { e.currentTarget.style.display = 'none' }} />
                  </div>
                )}
              </div>

              <div className="flex border-t border-gray-100">
                <button
                  onClick={() => handleReject(u.id)}
                  disabled={processingId === u.id}
                  className="flex-1 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 border-r border-gray-100"
                >
                  {processingId === u.id ? '⏳' : '✕ Reject & Delete'}
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
    </div>
  )
}