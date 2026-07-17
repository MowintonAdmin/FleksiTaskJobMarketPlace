import { useRef, useState } from 'react'
import { useAutoRefresh } from '../utils/useAutoRefresh'
import { toast } from 'react-toastify'
import api from '../api/client'

function SectionCard({ title, description, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{description}</p>
      </div>
      {children}
    </div>
  )
}

export default function DatabaseBackup() {
  const [backing, setBacking] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [restoreFile, setRestoreFile] = useState(null)
  const [confirmed, setConfirmed] = useState(false)
  const fileRef = useRef(null)

  // ── Backup ──────────────────────────────────────────────────────────────────
  const handleBackup = async () => {
    setBacking(true)
    try {
      const token = localStorage.getItem('admin_access_token')
      const baseUrl = api.defaults.baseURL
      const res = await fetch(`${baseUrl}/admin/database/backup`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `Server error ${res.status}`)
      }

      // Extract filename from Content-Disposition header if available
      const disposition = res.headers.get('content-disposition') || ''
      const match = disposition.match(/filename="?([^";\n]+)"?/)
      const filename = match ? match[1] : `fleksitask_backup_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.sql`

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      toast.success(`Backup downloaded: ${filename}`)
    } catch (e) {
      toast.error(e.message || 'Backup failed')
    } finally {
      setBacking(false)
    }
  }

  // ── Restore ─────────────────────────────────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setRestoreFile(file)
      setConfirmed(false)
    }
  }

  const handleRestore = async () => {
    if (!restoreFile || !confirmed) return
    setRestoring(true)
    try {
      const form = new FormData()
      form.append('file', restoreFile)
      const { data } = await api.post('/admin/database/restore', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      toast.success(data.message || 'Database restored successfully')
      setRestoreFile(null)
      setConfirmed(false)
      if (fileRef.current) fileRef.current.value = ''
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message || 'Restore failed')
    } finally {
      setRestoring(false)
    }
  }

  const fileSizeLabel = restoreFile
    ? restoreFile.size > 1024 * 1024
      ? `${(restoreFile.size / 1024 / 1024).toFixed(1)} MB`
      : `${(restoreFile.size / 1024).toFixed(1)} KB`
    : null

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Database Backup &amp; Restore</h1>
        <p className="text-sm text-gray-500 mt-1">
          Create a full SQL dump of the production database or restore from a previous backup.
        </p>
      </div>

      {/* Backup */}
      <SectionCard
        title="📦 Backup Database"
        description="Downloads a complete pg_dump of all tables and data as a .sql file. The file includes DROP statements so it can be cleanly restored later."
      >
        <button
          onClick={handleBackup}
          disabled={backing}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          {backing ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Generating backup…
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M8 12l4 4 4-4M12 4v12" />
              </svg>
              Download Backup
            </>
          )}
        </button>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700">
          The backup file includes <code className="font-mono bg-blue-100 px-1 rounded">--clean --if-exists</code> flags,
          meaning tables are dropped and recreated on restore. Keep the file secure — it contains all user and transaction data.
        </div>
      </SectionCard>

      {/* Restore */}
      <SectionCard
        title="♻️ Restore Database"
        description="Upload a .sql backup file generated by this tool. ALL existing data will be overwritten."
      >
        <div className="space-y-3">
          {/* File input */}
          <label className="block">
            <span className="sr-only">Choose SQL backup file</span>
            <input
              ref={fileRef}
              type="file"
              accept=".sql"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500
                file:mr-3 file:py-2 file:px-4
                file:rounded-lg file:border file:border-gray-300
                file:text-sm file:font-medium file:bg-gray-50
                file:text-gray-700 hover:file:bg-gray-100 cursor-pointer"
            />
          </label>

          {/* File preview */}
          {restoreFile && (
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-3-3v6M4.5 19.5l15-15m0 0H9m10.5 0v10.5" />
              </svg>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{restoreFile.name}</p>
                <p className="text-xs text-gray-500">{fileSizeLabel}</p>
              </div>
              <button
                onClick={() => { setRestoreFile(null); setConfirmed(false); if (fileRef.current) fileRef.current.value = '' }}
                className="ml-auto text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
          )}

          {/* Warning + confirmation */}
          {restoreFile && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-red-700">⚠️ Destructive operation</p>
              <p className="text-xs text-red-600">
                Restoring will <strong>drop all existing tables</strong> and replace them with the data from the backup file.
                This cannot be undone. Download a fresh backup first if you want to preserve current data.
              </p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="w-4 h-4 accent-red-600"
                />
                <span className="text-xs font-medium text-red-700">
                  I understand this will permanently overwrite all data
                </span>
              </label>
            </div>
          )}

          <button
            onClick={handleRestore}
            disabled={!restoreFile || !confirmed || restoring}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700
              disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-semibold
              rounded-xl transition-colors"
          >
            {restoring ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Restoring…
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0114.65-4.65M20 15a9 9 0 01-14.65 4.65" />
                </svg>
                Restore Database
              </>
            )}
          </button>
        </div>
      </SectionCard>
    </div>
  )
}
