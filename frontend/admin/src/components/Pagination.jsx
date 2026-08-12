const PAGE_SIZE = 20

export default function Pagination({ data, totalPages: totalPagesProp, page, onPage, pageSize = PAGE_SIZE }) {
  const totalPages = totalPagesProp != null ? totalPagesProp : (data ? Math.ceil(data.length / pageSize) : 1)
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-center gap-2 pt-3 pb-1">
      <button
        onClick={() => onPage(Math.max(1, page - 1))}
        disabled={page === 1}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
      >
        ← Prev
      </button>
      {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
        let pageNum
        if (totalPages <= 7) {
          pageNum = i + 1
        } else if (page <= 4) {
          pageNum = i + 1
        } else if (page >= totalPages - 3) {
          pageNum = totalPages - 6 + i
        } else {
          pageNum = page - 3 + i
        }
        return (
          <button
            key={pageNum}
            onClick={() => onPage(pageNum)}
            className={`w-8 h-8 text-sm rounded-lg font-medium transition-colors ${
              page === pageNum ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {pageNum}
          </button>
        )
      })}
      <button
        onClick={() => onPage(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
      >
        Next →
      </button>
    </div>
  )
}

export { PAGE_SIZE }