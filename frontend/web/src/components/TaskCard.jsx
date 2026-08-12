import { Link } from 'react-router-dom'
import { apiHost } from '../api/client'
import TagBadge from '../utils/tagColors'

const mediaUrl = (path) => (path ? `${apiHost}${path}` : null)

const STATUS_COLORS = {
  open: 'bg-green-100 text-green-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-600',
}

function formatCategoryTag(tag) {
  if (!tag) return ''
  const trimmed = String(tag).trim()
  if (!trimmed) return ''
  if (trimmed.length <= 3 && trimmed === trimmed.toUpperCase()) {
    return trimmed.toUpperCase()
  }
  return trimmed
    .split(' ')
    .map(w => {
      if (!w) return ''
      if (w.length <= 3 && w === w.toUpperCase()) return w
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    })
    .join(' ')
}

function parseCategoryTags(str) {
  if (!str) return []
  let rawList = []
  if (Array.isArray(str)) {
    rawList = str
  } else {
    try {
      const parsed = JSON.parse(str)
      if (Array.isArray(parsed)) rawList = parsed
    } catch {}
  }
  if (rawList.length === 0 && str) {
    rawList = String(str).replace(/，/g, ',').split(',')
  }

  const tagMap = new Map()
  rawList.forEach(raw => {
    const formatted = formatCategoryTag(raw)
    if (formatted && !tagMap.has(formatted.toLowerCase())) {
      tagMap.set(formatted.toLowerCase(), formatted)
    }
  })
  return Array.from(tagMap.values())
}

export default function TaskCard({ task }) {
  const totalPay = (task.pay_rate_per_minute * task.estimated_duration_minutes).toFixed(2)
  const categoryTags = parseCategoryTags(task.category)

  return (
    <Link to={`/tasks/${task.id}`} className="card hover:shadow-md transition-shadow block">
      {task.photo_url && (
        <img src={mediaUrl(task.photo_url)} alt={task.title} className="w-full h-36 object-cover rounded-xl mb-3 -mt-1" />
      )}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[task.status]}`}>
              {task.status
                .split('_')
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ')}
            </span>
            {categoryTags.map((cat, idx) => (
              <span key={idx} className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full break-words">
                {cat}
              </span>
            ))}
          </div>
          <h3 className="font-semibold text-gray-900 break-words leading-snug">{task.title}</h3>
          <p className="text-sm text-gray-500 mt-1 flex items-start gap-1 min-w-0">
            <span className="shrink-0">📍</span> <span className="break-words min-w-0">{task.location}</span>
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-base sm:text-lg font-bold text-primary-600 whitespace-nowrap">RM {totalPay}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 flex-wrap">
        <span>👥 {task.application_count} applied</span>
        {task.starts_at && (
          <span>🗓 {new Date(task.starts_at).toLocaleDateString()}</span>
        )}
        {task.company_tag && (
          <TagBadge tag={task.company_tag} size="xs" />
        )}
        {task.project_tag && (
          <TagBadge tag={task.project_tag} size="xs" />
        )}
      </div>
    </Link>
  )
}
