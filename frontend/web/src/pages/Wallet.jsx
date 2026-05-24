import { useEffect, useState, useCallback } from 'react'
import { walletApi } from '../api/wallet'
import { toast } from 'react-toastify'

const MY_BANKS = [
  { name: 'Maybank', digits: [12, 12] },
  { name: 'CIMB Bank', digits: [14, 14] },
  { name: 'Public Bank', digits: [10, 10] },
  { name: 'RHB Bank', digits: [14, 14] },
  { name: 'Hong Leong Bank', digits: [12, 12] },
  { name: 'AmBank', digits: [12, 12] },
  { name: 'Alliance Bank', digits: [12, 12] },
  { name: 'Affin Bank', digits: [16, 16] },
  { name: 'Bank Islam', digits: [16, 16] },
  { name: 'Bank Muamalat', digits: [16, 16] },
  { name: 'Bank Rakyat', digits: [16, 16] },
  { name: 'BSN (Bank Simpanan Nasional)', digits: [16, 16] },
  { name: 'Agrobank', digits: [11, 11] },
  { name: 'OCBC Bank Malaysia', digits: [10, 10] },
  { name: 'UOB Malaysia', digits: [11, 11] },
  { name: 'Standard Chartered Malaysia', digits: [8, 12] },
  { name: 'HSBC Bank Malaysia', digits: [12, 12] },
  { name: 'Citibank Malaysia', digits: [10, 10] },
  { name: 'Kuwait Finance House', digits: [16, 16] },
  { name: 'MBSB Bank', digits: [16, 16] },
]

function validateBankFields(bank_name, account_number, account_holder_name) {
  if (!bank_name) return 'Please select a bank.'
  const bank = MY_BANKS.find(b => b.name === bank_name)
  if (!bank) return 'Please select a valid Malaysian bank.'

  const digits = account_number.replace(/\s+/g, '')
  if (!/^\d+$/.test(digits))
    return 'Account number must contain digits only (no spaces, hyphens, or letters).'
  const [min, max] = bank.digits
  if (digits.length < min || digits.length > max)
    return `${bank_name} account numbers must be ${min === max ? min : `${min}–${max}`} digits.`

  if (!account_holder_name.trim()) return 'Account holder name is required.'
  if (account_holder_name.trim().length < 2) return 'Account holder name is too short.'
  if (!/^[A-Za-z\s'@/-]+$/.test(account_holder_name.trim()))
    return 'Account holder name must contain only letters and spaces (as per bank records).'

  return null
}

const TXN_STYLES = {
  CREDIT: { icon: '💰', color: 'text-green-600', sign: '+' },
  WITHDRAWAL_PENDING: { icon: '⏳', color: 'text-yellow-600', sign: '-' },
  WITHDRAWAL_COMPLETED: { icon: '✅', color: 'text-gray-500', sign: '-' },
  WITHDRAWAL_REJECTED: { icon: '↩️', color: 'text-blue-600', sign: '+' },
}

const WD_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-600',
}

/* ── Bank Account Modal ─────────────────────────────────────────────────── */
function BankAccountModal({ existing, onClose, onSaved }) {
  const [form, setForm] = useState({
    bank_name: existing?.bank_name || '',
    account_number: '',          // always cleared for security
    account_holder_name: existing?.account_holder_name || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    const validationError = validateBankFields(form.bank_name, form.account_number, form.account_holder_name)
    if (validationError) { setError(validationError); return }
    setSaving(true)
    setError('')
    try {
      await walletApi.upsertBankAccount({ ...form, account_number: form.account_number.replace(/\s+/g, '') })
      toast.success('Bank account saved')
      onSaved()
      onClose()
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to save bank account')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">🏦 Bank Account Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Bank Name</label>
            <select value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none bg-white">
              <option value="">— Select your bank —</option>
              {MY_BANKS.map(b => (
                <option key={b.name} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Account Number</label>
            <input value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))}
              placeholder="Digits only"
              inputMode="numeric"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Account Holder Name</label>
            <input value={form.account_holder_name} onChange={e => setForm(f => ({ ...f, account_holder_name: e.target.value }))}
              placeholder="Full name as per bank records"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Withdraw Modal ─────────────────────────────────────────────────────── */
function WithdrawModal({ maxAmount, bankAccount, onClose, onSuccess }) {
  const [amount, setAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    const val = parseFloat(amount)
    if (!val || val <= 0) { setError('Enter a valid amount'); return }
    if (val < 10) { setError('Minimum withdrawal amount is RM 10.00'); return }
    if (val > maxAmount) { setError(`Maximum available is RM ${maxAmount.toFixed(2)}`); return }
    setSubmitting(true)
    setError('')
    try {
      await walletApi.requestWithdrawal(val)
      toast.success('Withdrawal request submitted!')
      onSuccess()
      onClose()
    } catch (e) {
      setError(e.response?.data?.detail || 'Request failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">💸 Request Withdrawal</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-sm">
          <p className="text-gray-500">Transfer to: <span className="font-semibold text-gray-800">{bankAccount?.bank_name}</span></p>
          <p className="text-gray-500">Account: <span className="font-semibold text-gray-800">{bankAccount?.account_number}</span></p>
        </div>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Amount (RM)</label>
          <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary-500">
            <span className="px-3 py-2 bg-gray-100 text-gray-600 text-sm font-medium border-r border-gray-300">RM</span>
            <input type="number" min="10" step="0.01" max={maxAmount}
              value={amount} onChange={e => setAmount(e.target.value)}
              placeholder={`Max ${maxAmount.toFixed(2)}`}
              className="flex-1 px-3 py-2 text-sm focus:outline-none" />
          </div>
          <button onClick={() => setAmount(maxAmount.toFixed(2))}
            className="text-xs text-primary-600 hover:underline mt-1">
            Withdraw all (RM {maxAmount.toFixed(2)})
          </button>
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={submitting}
            className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 disabled:opacity-50">
            {submitting ? 'Submitting…' : 'Request'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Main Wallet Page ────────────────────────────────────────────────────── */
export default function Wallet() {
  const [wallet, setWallet] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [bankAccount, setBankAccount] = useState(null)
  const [withdrawals, setWithdrawals] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('transactions') // 'transactions' | 'withdrawals'
  const [showBankModal, setShowBankModal] = useState(false)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)

  const load = useCallback(async () => {
    try {
      const [w, txns, bank, wds] = await Promise.all([
        walletApi.getWallet(),
        walletApi.getTransactions(),
        walletApi.getBankAccount(),
        walletApi.getWithdrawals(),
      ])
      setWallet(w.data)
      setTransactions(txns.data)
      setBankAccount(bank.data)
      setWithdrawals(wds.data)
    } catch {
      toast.error('Failed to load wallet')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-4 animate-pulse">
        <div className="h-32 bg-gray-200 rounded-2xl" />
        <div className="h-10 bg-gray-200 rounded-xl" />
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 bg-gray-200 rounded-xl" />)}</div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Balance Card */}
      <div className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-2xl p-6 text-white shadow-lg">
        <p className="text-sm font-medium text-primary-200 mb-1">My Wallet</p>
        <p className="text-4xl font-bold mb-1">RM {wallet?.available_balance?.toFixed(2) ?? '0.00'}</p>
        <p className="text-sm text-primary-200">Available balance</p>
        {wallet?.pending_balance > 0 && (
          <div className="mt-3 bg-white/10 rounded-xl px-4 py-2 flex items-center justify-between">
            <span className="text-sm text-primary-100">⏳ Pending (active session)</span>
            <span className="text-sm font-semibold">RM {wallet.pending_balance.toFixed(2)}</span>
          </div>
        )}
        <div className="mt-4 flex gap-3">
          <button
            onClick={() => {
              if (!bankAccount) { setShowBankModal(true); return }
              setShowWithdrawModal(true)
            }}
            disabled={!wallet?.available_balance || wallet.available_balance <= 0}
            className="flex-1 bg-white text-primary-700 font-semibold py-2.5 rounded-xl text-sm hover:bg-primary-50 disabled:opacity-50 transition-colors">
            💸 Withdraw
          </button>
          <button onClick={() => setShowBankModal(true)}
            className="flex-1 bg-white/10 hover:bg-white/20 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
            🏦 {bankAccount ? 'Edit Bank' : 'Add Bank'}
          </button>
        </div>
      </div>

      {/* Bank account hint */}
      {!bankAccount && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-sm">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="font-semibold text-amber-800">No bank account linked</p>
            <p className="text-amber-700 mt-0.5">Add your bank account to enable withdrawals.</p>
            <button onClick={() => setShowBankModal(true)} className="text-primary-600 hover:underline font-medium mt-1">
              Add now →
            </button>
          </div>
        </div>
      )}

      {/* Bank account summary */}
      {bankAccount && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-xl">🏦</div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm">{bankAccount.bank_name}</p>
            <p className="text-xs text-gray-500">{bankAccount.account_holder_name} · {bankAccount.account_number}</p>
          </div>
          <button onClick={() => setShowBankModal(true)} className="text-xs text-primary-600 hover:underline font-medium">Edit</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {[['transactions', '📋 History'], ['withdrawals', '💸 Withdrawals']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
              tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Transaction History */}
      {tab === 'transactions' && (
        <div className="space-y-2">
          {transactions.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400">
              <p className="text-3xl mb-2">💳</p>
              <p className="font-medium">No transactions yet</p>
              <p className="text-xs mt-1">Complete tasks to start earning</p>
            </div>
          ) : (() => {
            const resolvedWithdrawalIds = new Set(
              transactions
                .filter(t => t.type === 'WITHDRAWAL_COMPLETED' || t.type === 'WITHDRAWAL_REJECTED')
                .map(t => t.reference_id)
                .filter(Boolean)
            )
            return transactions.filter(txn =>
              !(txn.type === 'WITHDRAWAL_PENDING' && resolvedWithdrawalIds.has(txn.reference_id))
            )
          })().map(txn => {
            const s = TXN_STYLES[txn.type] || { icon: '•', color: 'text-gray-600', sign: '' }
            return (
              <div key={txn.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3">
                <span className="text-xl">{s.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{txn.description}</p>
                  <p className="text-xs text-gray-400">{new Date(txn.created_at).toLocaleString()}</p>
                </div>
                <p className={`text-sm font-bold ${s.color}`}>
                  {s.sign}RM {Math.abs(txn.amount).toFixed(2)}
                </p>
              </div>
            )
          })}
        </div>
      )}

      {/* Withdrawal History */}
      {tab === 'withdrawals' && (
        <div className="space-y-2">
          {withdrawals.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400">
              <p className="text-3xl mb-2">💸</p>
              <p className="font-medium">No withdrawal requests yet</p>
            </div>
          ) : withdrawals.map(w => (
            <div key={w.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">RM {w.amount.toFixed(2)}</p>
                  <p className="text-xs text-gray-500">{w.bank_name} · {w.account_number}</p>
                  <p className="text-xs text-gray-400">{new Date(w.created_at).toLocaleString()}</p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${WD_COLORS[w.status]}`}>
                  {w.status}
                </span>
              </div>
              {w.admin_notes && (
                <p className="text-xs text-gray-500 mt-2 bg-gray-50 rounded-lg px-3 py-1.5 italic">
                  Admin: {w.admin_notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {showBankModal && (
        <BankAccountModal
          existing={bankAccount}
          onClose={() => setShowBankModal(false)}
          onSaved={() => { walletApi.getBankAccount().then(r => setBankAccount(r.data)).catch(() => {}) }}
        />
      )}
      {showWithdrawModal && bankAccount && (
        <WithdrawModal
          maxAmount={wallet?.available_balance ?? 0}
          bankAccount={bankAccount}
          onClose={() => setShowWithdrawModal(false)}
          onSuccess={load}
        />
      )}
    </div>
  )
}
