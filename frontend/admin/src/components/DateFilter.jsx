import { useState } from 'react'

/**
 * Clean Date Range Filter (Start Date to End Date) for Admin Pages.
 */
export default function DateFilter({
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  onReset,
  onPageReset,
}) {
  const hasFilter = Boolean(startDate || endDate)

  const handleClear = () => {
    onStartDateChange('')
    onEndDateChange('')
    if (onReset) onReset()
    if (onPageReset) onPageReset()
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Date Range Inputs Bar */}
      <div className="flex items-center gap-1.5 bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 shadow-sm text-sm">
        <span className="text-gray-500 font-medium flex items-center gap-1">
          <span>🗓</span> Range:
        </span>
        <input
          type="date"
          value={startDate || ''}
          onChange={(e) => {
            onStartDateChange(e.target.value)
            if (onPageReset) onPageReset()
          }}
          className="text-xs font-medium text-gray-700 bg-transparent focus:outline-none cursor-pointer"
        />
        <span className="text-gray-400 text-xs font-normal">to</span>
        <input
          type="date"
          value={endDate || ''}
          onChange={(e) => {
            onEndDateChange(e.target.value)
            if (onPageReset) onPageReset()
          }}
          className="text-xs font-medium text-gray-700 bg-transparent focus:outline-none cursor-pointer"
        />
      </div>

      {/* Clear Button */}
      {hasFilter && (
        <button
          type="button"
          onClick={handleClear}
          className="text-xs px-2.5 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200 font-semibold hover:bg-red-100 transition-colors"
          title="Clear Date Filter"
        >
          ✕ Clear
        </button>
      )}
    </div>
  )
}

export function filterRecordsByDate(items, { startDate, endDate }, dateKey = 'created_at') {
  if (!items || items.length === 0) return []
  if (!startDate && !endDate) return items

  return items.filter((item) => {
    const rawDate = item[dateKey] || item.starts_at || item.checked_in_at || item.created_at
    if (!rawDate) return true
    const itemDate = new Date(rawDate)

    if (startDate) {
      const start = new Date(startDate)
      start.setHours(0, 0, 0, 0)
      if (itemDate < start) return false
    }

    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      if (itemDate > end) return false
    }

    return true
  })
}
