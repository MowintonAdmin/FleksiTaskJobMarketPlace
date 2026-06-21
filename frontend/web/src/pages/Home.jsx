import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { fetchTasks } from '../store/taskSlice'
import TaskCard from '../components/TaskCard'
import FilterBar from '../components/FilterBar'
import { walletApi } from '../api/wallet'

export default function Home() {
  const dispatch = useDispatch()
  const { items, loading, error, total, page, totalPages, filters } = useSelector((s) => s.tasks)
  const { accessToken } = useSelector((s) => s.auth)
  const [wallet, setWallet] = useState(null)

  useEffect(() => {
    dispatch(fetchTasks({}))
  }, [dispatch])

  useEffect(() => {
    if (accessToken) {
      walletApi.getWallet().then(r => setWallet(r.data)).catch(() => {})
    }
  }, [accessToken])

  const handlePage = (newPage) => {
    dispatch(fetchTasks({ ...filters, page: newPage }))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Wallet Banner (logged-in users only) */}
      {accessToken && wallet && (
        <Link to="/wallet" className="block bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-4 mb-6 text-white hover:from-primary-700 hover:to-primary-800 transition-colors shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-primary-200">My Wallet</p>
              <p className="text-2xl font-bold">RM {wallet.available_balance.toFixed(2)}</p>
              {wallet.pending_balance > 0 && (
                <p className="text-xs text-primary-200 mt-0.5">⏳ RM {wallet.pending_balance.toFixed(2)} pending</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-3xl">💰</p>
              <p className="text-xs text-primary-200 mt-1">View Wallet →</p>
            </div>
          </div>
        </Link>
      )}

      {/* Hero */}
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
          Find Flexible Work <span className="text-primary-600">Near You</span>
        </h1>
        <p className="mt-2 text-gray-600 text-lg">Browse tasks, apply in one tap, and start earning today.</p>

        {/* Android app download */}
        <div className="mt-4 inline-flex items-center gap-3 bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-md hover:bg-gray-800 transition-colors">
          <svg className="w-6 h-6 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.523 15.341 14.03 9h-4.06l-3.493 6.341A8.977 8.977 0 0 1 3 12C3 7.029 7.029 3 12 3s9 4.029 9 9a8.977 8.977 0 0 1-3.477 3.341ZM12 21a8.963 8.963 0 0 1-5.294-1.706L9.03 15h5.94l2.324 4.294A8.963 8.963 0 0 1 12 21Z"/>
          </svg>
          <a
            href="/media/downloads/fleksitask.apk"
            download="FleksiTask.apk"
            className="text-sm font-semibold leading-tight"
          >
            <span className="block text-xs text-gray-400 font-normal">Get it on</span>
            Android
          </a>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <FilterBar filters={filters} />
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-600">
          {loading ? 'Loading...' : `${total} task${total !== 1 ? 's' : ''} available`}
        </p>
      </div>

      {/* Error */}
      {error && <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg p-3 mb-4 text-sm">{error}</div>}

      {/* Task Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/2 mb-4" />
              <div className="h-8 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-4xl mb-3">🔍</p>
          <p className="font-medium">No tasks found</p>
          <p className="text-sm mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((task) => <TaskCard key={task.id} task={task} />)}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          <button
            onClick={() => handlePage(page - 1)}
            disabled={page === 1}
            className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="flex items-center text-sm text-gray-600 px-3">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => handlePage(page + 1)}
            disabled={page === totalPages}
            className="btn-secondary px-3 py-1.5 text-xs disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
