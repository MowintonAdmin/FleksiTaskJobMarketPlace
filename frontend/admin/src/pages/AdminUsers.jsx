import { useEffect, useState, useCallback } from 'react'
import { useSelector } from 'react-redux'
import api from '../api/client'
import { toast } from 'react-toastify'
import TagBadge from '../utils/tagColors'

export default function AdminUsers() {
  const { user } = useSelector((s) => s.auth)
  const isSuperAdmin = user?.is_super_admin

  const [admins, setAdmins] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  // Create admin modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newFullName, setNewFullName] = useState('')
  const [newCompanyTag, setNewCompanyTag] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    const params = search ? { search } : {}
    api.get('/admin/users/admins', { params })
      .then(r => setAdmins(r.data))
      .catch(() => toast.error('Failed to load admin users'))
      .finally(() => setLoading(false))
  }, [search])

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [load])

  const handleCreateAdmin = async (e) => {
    e.preventDefault()
    if (!newEmail.trim() || !newPassword.trim()) {
      toast.error('Email and password are required')
      return
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setCreating(true)
    try {
      const { data } = await api.post('/admin/users/create-admin', {
        email: newEmail.trim(),
        password: newPassword,
        full_name: newFullName.trim() || null,
        company_tag: newCompanyTag.trim() || null,
      })
      toast.success(data.message || 'Admin account created!')
      setShowCreateModal(false)
      setNewEmail('')
      setNewPassword('')
      setNewFullName('')
      setNewCompanyTag('')
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create admin account')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Admin Users <span className="text-gray-400 font-normal text-lg">({admins.length})</span>
          {isSuperAdmin && (
            <span className="ml-3 text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 font-medium align-middle">
              Super Admin
            </span>
          )}
        </h1>
        <div className="flex items-center gap-3">
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      {/* Create admin section – different UI based on role */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-900 text-sm">Create New Admin Account</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {isSuperAdmin
              ? 'Add a new normal admin who can manage their own projects and data.'
              : 'Only a Super Admin can create new admin accounts. Please contact the system administrator.'}
          </p>
        </div>
        {isSuperAdmin ? (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            + Create Admin
          </button>
        ) : (
          <span className="px-3 py-1.5 bg-gray-100 text-gray-400 text-xs rounded-lg font-medium cursor-not-allowed">
            🔒 Super Admin Only
          </span>
        )}
      </div>

      {/* Admin list table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase border-b border-gray-100">
            <tr>
              <th className="px-5 py-3 text-left">Admin</th>
              <th className="px-5 py-3 text-left">Email</th>
              <th className="px-5 py-3 text-left">Company</th>
              <th className="px-5 py-3 text-left">Type</th>
              <th className="px-5 py-3 text-left">Location</th>
              <th className="px-5 py-3 text-center">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              [1, 2, 3].map(i => (
                <tr key={i}>{[1, 2, 3, 4, 5, 6].map(j => (
                  <td key={j} className="px-5 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                ))}</tr>
              ))
            ) : admins.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">No admin users found</td></tr>
            ) : admins.map(u => (
              <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    {u.profile_photo_url
                      ? <img src={u.profile_photo_url} alt="" referrerPolicy="no-referrer" className="w-9 h-9 rounded-full object-cover" />
                      : <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-sm font-bold text-purple-600">
                          {(u.full_name || u.email || '?')[0].toUpperCase()}
                        </div>
                    }
                    <div>
                      <p className="font-medium text-gray-900">{u.full_name || '—'}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                        {u.is_super_admin ? 'Super Admin' : 'Admin'}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 text-gray-500">{u.email}</td>
                <td className="px-5 py-3">
                  <TagBadge tag={u.company_tag} size="xs" />
                </td>
                <td className="px-5 py-3">
                  {u.is_super_admin ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">👑 Super</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">Normal</span>
                  )}
                </td>
                <td className="px-5 py-3 text-gray-500">{u.location || '—'}</td>
                <td className="px-5 py-3 text-center text-gray-400 text-xs">
                  {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Admin Modal (Super Admin only) */}
      {showCreateModal && isSuperAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">➕ Create Normal Admin</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">✕</button>
            </div>
            <form onSubmit={handleCreateAdmin} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Full Name <span className="text-gray-400 normal-case font-normal">(optional)</span></label>
                <input
                  value={newFullName} onChange={e => setNewFullName(e.target.value)}
                  placeholder="e.g. John Admin"
                  maxLength={255}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Company Tag *</label>
                <input
                  required
                  value={newCompanyTag} onChange={e => setNewCompanyTag(e.target.value)}
                  placeholder="e.g. CleaningPro, TechServ, etc."
                  maxLength={100}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
                <p className="text-xs text-gray-400 mt-1">This tag helps identify which company this admin belongs to. Admins with the same tag will see each other's data.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Email *</label>
                <input
                  required type="email"
                  value={newEmail} onChange={e => setNewEmail(e.target.value)}
                  placeholder="admin@example.com"
                  maxLength={254}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Password *</label>
                <input
                  required type="password" minLength={6}
                  value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
              <div className="bg-purple-50 rounded-lg px-4 py-3 text-xs text-purple-700 space-y-1">
                <p className="font-semibold">📌 Note</p>
                <p>The new admin will have <strong>normal</strong> privileges — they can create their own projects and manage tasks/workers within those projects. They <strong>cannot</strong> create other admin accounts or access super admin features.</p>
                <p>They will only see other admins and data with the <strong>same company tag</strong>.</p>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={creating} className="px-5 py-2 text-sm bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50">
                  {creating ? 'Creating…' : 'Create Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}