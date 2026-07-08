/**
 * Standardized Search + Filter Bar for all admin pages.
 * Provides a consistent UI pattern with search input on the left and optional filter dropdowns on the right.
 *
 * Usage:
 *   <SearchFilterBar
 *     search={search}
 *     onSearchChange={setSearch}
 *     placeholder="Search by name or email…"
 *     filters={[
 *       { value: filterStatus, onChange: setFilterStatus, options: [
 *         { value: '', label: 'All statuses' },
 *         { value: 'open', label: 'Open' },
 *       ]},
 *     ]}
 *   />
 */
export default function SearchFilterBar({
  search,
  onSearchChange,
  placeholder = 'Search…',
  filters = [],
  rightContent,
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="flex-1 relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input
          type="text"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />
      </div>
      {filters.map((filter, i) => (
        <select
          key={i}
          value={filter.value}
          onChange={e => { filter.onChange(e.target.value); if (filter.onPageReset) filter.onPageReset() }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white min-w-[140px]"
        >
          {filter.options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ))}
      {rightContent && <div className="shrink-0">{rightContent}</div>}
    </div>
  )
}