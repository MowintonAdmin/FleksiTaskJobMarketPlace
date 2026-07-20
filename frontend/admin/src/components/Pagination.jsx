export default function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null

  const pages = []
  const start = Math.max(1, page - 2)
  const end = Math.min(totalPages, page + 2)

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  return (
    <div className="flex items-center justify-center gap-1.5 pt-4 pb-2">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg disabled:opacity-30 hover:bg-gray-50 disabled:cursor-not-allowed"
      >
        ← Prev
      </button>
      {start > 1 && (
        <>
          <button onClick={() => onChange(1)} className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">1</button>
          {start > 2 && <span className="px-1 text-gray-400 text-xs">…</span>}
        </>
      )}
      {pages.map(i => (
        <button
          key={i}
          onClick={() => onChange(i)}
          className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
            i === page
              ? 'bg-blue-600 text-white border-blue-600 font-semibold'
              : 'border-gray-300 hover:bg-gray-50'
          }`}
        >
          {i}
        </button>
      ))}
      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="px-1 text-gray-400 text-xs">…</span>}
          <button onClick={() => onChange(totalPages)} className="px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50">{totalPages}</button>
        </>
      )}
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg disabled:opacity-30 hover:bg-gray-50 disabled:cursor-not-allowed"
      >
        Next →
      </button>
    </div>
  )
}