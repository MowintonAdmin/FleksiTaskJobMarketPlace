import { Link } from 'react-router-dom'
import { apiHost } from '../api/client'

const mediaUrl = (path) => (path ? `${apiHost}${path}` : null)

const STATUS_COLORS = {
  open: 'bg-green-100 text-green-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-600',
}

export default function TaskCard({ task }) {
  const totalPay = (task.pay_rate_per_minute * task.estimated_duration_minutes).toFixed(2)

  return (
    <Link to={`/tasks/${task.id}`} className="card hover:shadow-md transition-shadow block">
      {task.photo_url && (
        <img src={mediaUrl(task.photo_url)} alt={task.title} className="w-full h-36 object-cover rounded-xl mb-3 -mt-1" />
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[task.status]}`}>
              {task.status
                .split('_')
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ')}
            </span>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {task.category}
            </span>
          </div>
          <h3 className="font-semibold text-gray-900 truncate">{task.title}</h3>
          <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
            <span>📍</span> {task.location}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-primary-600">RM {totalPay}</p>
          <p className="text-xs text-gray-500">RM {task.pay_rate_per_minute}/min</p>
        </div>
      </div>
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
        <span>⏱ {task.estimated_duration_minutes} min</span>
        <span>👥 {task.application_count} applied</span>
        {task.starts_at && (
          <span>🗓 {new Date(task.starts_at).toLocaleDateString()}</span>
        )}
      </div>
    </Link>
  )
}
