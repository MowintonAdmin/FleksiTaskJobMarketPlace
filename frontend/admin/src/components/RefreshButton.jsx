/**
 * Standardized Refresh button for all admin pages.
 * Provides consistent visual style, loading state, and optional last-refresh timestamp.
 *
 * Usage:
 *   <RefreshButton onClick={load} loading={loading} />
 *   <RefreshButton onClick={load} loading={loading} lastRefresh={lastRefresh} />
 */
export default function RefreshButton({ onClick, loading = false, lastRefresh = null }) {
  return (
    <div className="flex items-center gap-2">
      {lastRefresh && (
        <span className="text-xs text-gray-400 hidden sm:inline">
          Last updated {lastRefresh.toLocaleTimeString()}
        </span>
      )}
      <button
        onClick={onClick}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg
          className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        {loading ? 'Refreshing...' : 'Refresh'}
      </button>
    </div>
  )
}