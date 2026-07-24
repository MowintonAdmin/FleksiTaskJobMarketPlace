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

  // Edit/Reset/Delete state
  const [editingAdmin, setEditingAdmin] = useState(null)
  const [editFullName, setEditFullName] = useState('')
  const [editCompanyTag, setEditCompanyTag] = useState('')
  const [editIsSuper, setEditIsSuper] = useState(false)
  const [saving, setSaving] = useState(false)

  const [resettingAdmin, setResettingAdmin] = useState(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetting, setResetting] = useState(false)

  const [deletingAdmin, setDeletingAdmin] = useState(null)
  const [deleting, setDeleting] = useState(false)

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

  const openEditModal = (admin) => {
    setEditingAdmin(admin)
    setEditFullName(admin.full_name || '')
    setEditCompanyTag(admin.company_tag || '')
    setEditIsSuper(admin.is_super_admin || false)
  }

  const handleEditAdmin = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data } = await api.put(`/admin/users/admins/${editingAdmin.id}`, {
        full_name: editFullName.trim() || null,
        company_tag: editCompanyTag.trim() || null,
        is_super_admin: editIsSuper,
      })
      toast.success(data.message || 'Admin updated!')
      setEditingAdmin(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update admin')
    } finally {
      setSaving(false)
    }
  }

  const openResetModal = (admin) => {
    setResettingAdmin(admin)
    setResetPassword('')
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    if (resetPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setResetting(true)
    try {
      const { data } = await api.post(`/admin/users/admins/${resettingAdmin.id}/reset-password`, {
        new_password: resetPassword,
      })
      toast.success(data.message || 'Password reset!')
      setResettingAdmin(null)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reset password')
    } finally {
      setResetting(false)
    }
  }

  const openDeleteConfirm = (admin) => {
    setDeletingAdmin(admin)
  }

  const handleDeleteAdmin = async () => {
    setDeleting(true)
    try {
      const { data } = await api.delete(`/admin/users/admins/${deletingAdmin.id}`)
      toast.success(data.message || 'Admin deleted!')
      setDeletingAdmin(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete admin')
    } finally {
      setDeleting(false)
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
              {isSuperAdmin && <th className="px-5 py-3 text-center">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              [1, 2, 3].map(i => (
                <tr key={i}>{[1, 2, 3, 4, 5, 6, 7].map(j => (
                  <td key={j} className="px-5 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                ))}</tr>
              ))
            ) : admins.length === 0 ? (
              <tr><td colSpan={isSuperAdmin ? 7 : 6} className="text-center py-12 text-gray-400">No admin users found</td></tr>
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
                      {u.id === user?.id && (
                        <span className="text-xs text-purple-600 font-medium">You</span>
                      )}
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
                {isSuperAdmin && (
                  <td className="px-5 py-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => openEditModal(u)}
                        title="Edit"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => openResetModal(u)}
                        title="Reset Password"
                        className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                      >
                        🔑
                      </button>
                      {u.id !== user?.id && (
                        <button
                          onClick={() => openDeleteConfirm(u)}
                          title="Delete"
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Admin Modal */}
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
                <input value={newFullName} onChange={e => setNewFullName(e.target.value)} placeholder="e.g. John Admin" maxLength={255}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Company Tag *</label>
                <input required value={newCompanyTag} onChange={e => setNewCompanyTag(e.target.value)} placeholder="e.g. CleaningPro, TechServ" maxLength={100}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" />
                <p className="text-xs text-gray-400 mt-1">Admins with the same tag will see each other's data.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Email *</label>
                <input required type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="admin@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Password *</label>
                <input required type="password" minLength={6} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min. 6 characters"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={creating}
                  className="px-5 py-2 text-sm bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50">
                  {creating ? 'Creating…' : 'Create Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Admin Modal */}
      {editingAdmin && isSuperAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">✏️ Edit Admin</h2>
              <button onClick={() => setEditingAdmin(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">✕</button>
            </div>
            <form onSubmit={handleEditAdmin} className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-500">Editing: <strong>{editingAdmin.email}</strong></p>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Full Name</label>
                <input value={editFullName} onChange={e => setEditFullName(e.target.value)} maxLength={255}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Company Tag</label>
                <input value={editCompanyTag} onChange={e => setEditCompanyTag(e.target.value)} maxLength={100}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none" />
              </div>
              {editingAdmin.id !== user?.id && (
                <div className="flex items-center gap-3">
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Super Admin</label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={editIsSuper} onChange={e => setEditIsSuper(e.target.checked)}
                      className="sr-only peer" />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-yellow-500"></div>
                  </label>
                  <span className="text-xs text-gray-400">{editIsSuper ? '👑 Yes' : 'Normal'}</span>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setEditingAdmin(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving}
                  className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resettingAdmin && isSuperAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">🔑 Reset Password</h2>
              <button onClick={() => setResettingAdmin(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">✕</button>
            </div>
            <form onSubmit={handleResetPassword} className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-500">Resetting password for: <strong>{resettingAdmin.email}</strong></p>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">New Password *</label>
                <input required type="password" minLength={6} value={resetPassword} onChange={e => setResetPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setResettingAdmin(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={resetting}
                  className="px-5 py-2 text-sm bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 transition-colors disabled:opacity-50">
                  {resetting ? 'Resetting…' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deletingAdmin && isSuperAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 py-5 text-center space-y-3">
              <p className="text-4xl">⚠️</p>
              <h2 className="text-lg font-bold text-gray-900">Delete Admin?</h2>
              <p className="text-sm text-gray-500">
                Are you sure you want to delete <strong>{deletingAdmin.email}</strong>?
                This action <span className="text-red-500 font-semibold">cannot be undone</span>.
              </p>
            </div>
            <div className="flex gap-3 px-6 pb-5">
              <button onClick={() => setDeletingAdmin(null)} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={handleDeleteAdmin} disabled={deleting}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50">
                {deleting ? 'Deleting…' : '🗑️ Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}