import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { fetchTasks, setFilters } from '../store/taskSlice'

const CATEGORIES = ['Cleaning', 'Delivery', 'Events', 'Gardening', 'Moving', 'Repair', 'Security', 'Other']

export default function FilterBar({ filters }) {
  const dispatch = useDispatch()
  const [local, setLocal] = useState(filters)

  const handleChange = (e) => {
    setLocal((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleApply = () => {
    dispatch(setFilters(local))
    dispatch(fetchTasks({
      location: local.location,
      category: local.category,
      minPay: local.minPay,
      maxPay: local.maxPay,
    }))
  }

  const handleReset = () => {
    const empty = { location: '', category: '', minPay: '', maxPay: '' }
    setLocal(empty)
    dispatch(setFilters(empty))
    dispatch(fetchTasks({}))
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Filter Tasks</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
          <input
            name="location"
            value={local.location}
            onChange={handleChange}
            placeholder="City or area..."
            className="input"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
          <select name="category" value={local.category} onChange={handleChange} className="input">
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Min Pay (RM/hour)</label>
          <input
            name="minPay"
            type="number"
            min="0"
            step="0.50"
            value={local.minPay}
            onChange={handleChange}
            placeholder="10.00"
            className="input"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Max Pay (RM/hour)</label>
          <input
            name="maxPay"
            type="number"
            min="0"
            step="0.50"
            value={local.maxPay}
            onChange={handleChange}
            placeholder="Any"
            className="input"
          />
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={handleApply} className="btn-primary">Apply Filters</button>
        <button onClick={handleReset} className="btn-secondary">Reset</button>
      </div>
    </div>
  )
}