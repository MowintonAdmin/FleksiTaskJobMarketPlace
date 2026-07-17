import { useEffect, useState, useRef } from 'react'
import { useAutoRefresh } from '../utils/useAutoRefresh'
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
  const filtersRef = useRef(filters)

  // Keep filters ref in sync
  useEffect(() => { filtersRef.current = filters }, [filters])

  useEffect(() => {
    dispatch(fetchTasks({}))

    // Auto-refresh tasks every 15 seconds so new tasks from admin appear
    // without needing a manual page refresh.
    const intervalId = setInterval(() => {
      dispatch(fetchTasks({ ...filtersRef.current }))
    }, 5000)

    return () => clearInterval(intervalId)
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
          <svg className="w-7 h-7 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5S11 23.33 11 22.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zm-2.5-1C2.67 17 2 16.33 2 15.5v-7C2 7.67 2.67 7 3.5 7S5 7.67 5 8.5v7c0 .83-.67 1.5-1.5 1.5zm17 0c-.83 0-1.5-.67-1.5-1.5v-7c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v7c0 .83-.67 1.5-1.5 1.5zM15.53 2.16l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48C13.85 1.23 12.95 1 12 1c-.96 0-1.86.23-2.66.63L7.85.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31C7.08 3.04 6 4.6 6 6.5h12c0-1.9-1.08-3.46-2.47-4.34zM10 5H9V4h1v1zm5 0h-1V4h1v1z"/>
          </svg>
          <a
            href="/media/downloads/flekxitask.apk"
            download="FlekxiTask.apk"
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
