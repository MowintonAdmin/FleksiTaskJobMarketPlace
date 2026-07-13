import { useEffect, useState, useCallback } from 'react'
import api from '../api/client'
import { toast } from 'react-toastify'
import SearchFilterBar from '../components/SearchFilterBar'
import usePolling from '../hooks/usePolling'

const STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-600',
}

const formatStatusLabel = (status) =>
  String(status || '')
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

function ProcessModal({ withdrawal, onClose, onDone }) {
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [previewImage, setPreviewImage] = useState(null)

  const process = async (action) => {
    setSubmitting(true)
    try {
      await api.patch(`/admin/withdrawals/${withdrawal.id}`, { action, notes: notes || null })
      toast.success(`Withdrawal ${action === 'reject' ? 'rejected' : 'approved'} successfully`)
      onDone()
      onClose()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Action failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Process Withdrawal</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
          </div>

          {/* Summary */}
          <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Worker</span>
              <span className="font-semibold text-gray-900">{withdrawal.worker_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Amount</span>
              <span className="font-bold text-gray-900 text-base">RM {withdrawal.amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Bank</span>
              <span className="font-semibold text-gray-900">{withdrawal.bank_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Account</span>
              <span className="font-semibold text-gray-900">{withdrawal.account_holder_name} · {withdrawal.account_number}</span>
            </div>
            {withdrawal.worker_bank_qr_url && (
              <div className="pt-2 border-t border-gray-200">
                <p className="text-xs text-gray-400 mb-2">🏦 Bank QR Code — click to preview, scan to pay</p>
                <img
                  src={withdrawal.worker_bank_qr_url}
                  alt="Bank QR"
                  className="w-32 h-32 rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity mx-auto"
                  onClick={() => setPreviewImage(withdrawal.worker_bank_qr_url)}
                  style={{ objectFit: 'contain' }}
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Add a note to the worker…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none" />
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={() => process('reject')} disabled={submitting}
              className="flex-1 py-2.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-sm font-semibold disabled:opacity-50">
              ✗ Reject
            </button>
            <button onClick={() => process('approve')} disabled={submitting}
              className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50">
              ✓ Approve
            </button>
          </div>
        </div>
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-2xl w-full max-h-[90vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPreviewImage(null)} className="absolute -top-10 right-0 text-white hover:text-gray-300 text-2xl font-bold z-10">
              ✕ Close
            </button>
            <img src={previewImage} alt="Preview" className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain" />
          </div>
        </div>
      )}
    </>
  )
}

export default function Withdrawals() {
  const [withdrawals, setWithdrawals] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('PENDING')
  const [selected, setSelected] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    const params = filterStatus ? { status: filterStatus } : {}
    api.get('/admin/withdrawals', { params })
      .then(r => setWithdrawals(r.data))
      .catch(() => toast.error('Failed to load withdrawals'))
      .finally(() => setLoading(false))
  }, [filterStatus])

  useEffect(() => { load() }, [load])

  // Auto-refresh withdrawals list every 5s
  usePolling(load, 5000)

  const pending = withdrawals.filter(w => w.status === 'PENDING').length

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          💸 Withdrawals
          {pending > 0 && (
            <span className="text-xs bg-red-500 text-white rounded-full px-2 py-0.5 font-medium">{pending}</span>
          )}
        </h1>
        <SearchFilterBar
          search=""
          onSearchChange={() => {}}
          placeholder=""
          filters={[
            {
              value: filterStatus,
              onChange: setFilterStatus,
              options: [
                { value: '', label: 'All statuses' },
                { value: 'PENDING', label: 'Pending' },
                { value: 'APPROVED', label: 'Approved' },
                { value: 'REJECTED', label: 'Rejected' },
              ],
            },
          ]}
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase border-b border-gray-100">
            <tr>
              <th className="px-5 py-3 text-left">Worker</th>
              <th className="px-5 py-3 text-left">Amount</th>
              <th className="px-5 py-3 text-left">Bank</th>
              <th className="px-5 py-3 text-left">QR Code</th>
              <th className="px-5 py-3 text-left">Requested</th>
              <th className="px-5 py-3 text-center">Status</th>
              <th className="px-5 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              [1,2,3].map(i => (
                <tr key={i}>{[1,2,3,4,5,6,7].map(j => (
                  <td key={j} className="px-5 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                ))}</tr>
              ))
            ) : withdrawals.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-400">
                  <p className="text-3xl mb-2">✅</p>
                  <p>No {formatStatusLabel(filterStatus) || ''} withdrawal requests</p>
                </td>
              </tr>
            ) : withdrawals.map(w => (
              <tr key={w.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3">
                  <p className="font-medium text-gray-900">{w.worker_name}</p>
                  <p className="text-xs text-gray-400">{w.worker_email}</p>
                </td>
                <td className="px-5 py-3">
                  <p className="font-bold text-gray-900">RM {w.amount.toFixed(2)}</p>
                </td>
                <td className="px-5 py-3 text-gray-600">
                  <p>{w.bank_name}</p>
                  <p className="text-xs text-gray-400">{w.account_holder_name} · {w.account_number}</p>
                </td>
                <td className="px-5 py-3">
                  {w.worker_bank_qr_url ? (
                    <img
                      src={w.worker_bank_qr_url}
                      alt="QR"
                      className="w-10 h-10 rounded border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setSelected({ ...w, _previewQr: true })}
                      style={{ objectFit: 'contain' }}
                    />
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
                <td className="px-5 py-3 text-gray-400 text-xs">
                  {new Date(w.created_at).toLocaleString()}
                </td>
                <td className="px-5 py-3 text-center">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLORS[w.status]}`}>
                    {formatStatusLabel(w.status)}
                  </span>
                </td>
                <td className="px-5 py-3 text-center">
                  {w.status === 'PENDING' ? (
                    <button onClick={() => setSelected(w)}
                      className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg hover:bg-blue-100 transition-colors">
                      Process
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400 italic">{w.admin_notes ? `"${w.admin_notes}"` : '—'}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <ProcessModal
          withdrawal={selected}
          onClose={() => setSelected(null)}
          onDone={load}
        />
      )}
    </div>
  )
}