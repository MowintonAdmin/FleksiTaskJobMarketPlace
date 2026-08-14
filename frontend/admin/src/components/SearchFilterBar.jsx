import { useState, useRef, useEffect } from 'react'

/**
 * Custom Scrollable Filter Dropdown that displays max 6 items
 * and enables mouse wheel scrolling for remaining items.
 */
function CustomFilterSelect({ filter }) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  const selectedOpt = filter.options.find(opt => String(opt.value) === String(filter.value)) || filter.options[0]

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative min-w-[160px]" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white flex items-center justify-between gap-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-gray-700 shadow-xs hover:border-gray-400 transition-colors"
      >
        <span className="truncate text-left font-medium">{selectedOpt ? selectedOpt.label : 'Select…'}</span>
        <span className={`text-gray-400 text-xs transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>

      {/* Floating scrollable menu limited to max 6 items with mouse wheel scroll */}
      {isOpen && (
        <div
          className="absolute right-0 mt-1.5 w-full min-w-[200px] bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-y-auto max-h-[215px] py-1 border-t border-gray-100"
          style={{ scrollbarWidth: 'thin' }}
        >
          {filter.options.map((opt) => {
            const isSelected = String(opt.value) === String(filter.value)
            return (
              <div
                key={opt.value}
                onClick={() => {
                  filter.onChange(opt.value)
                  if (filter.onPageReset) filter.onPageReset()
                  setIsOpen(false)
                }}
                className={`px-3.5 py-2 text-sm cursor-pointer transition-colors flex items-center justify-between ${
                  isSelected ? 'bg-blue-600 text-white font-semibold' : 'text-gray-700 hover:bg-blue-50 hover:text-blue-600'
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <span className="text-xs ml-2 font-bold">✓</span>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * Standardized Search + Filter Bar for all admin pages.
 * Provides a consistent UI pattern with search input on the left and scrollable filter dropdowns on the right.
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
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
        />
      </div>
      {filters.map((filter, i) => (
        <CustomFilterSelect key={i} filter={filter} />
      ))}
      {rightContent && <div className="shrink-0">{rightContent}</div>}
    </div>
  )
}