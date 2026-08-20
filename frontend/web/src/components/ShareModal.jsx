import { useState } from 'react'
import { toast } from 'react-toastify'

/**
 * ShareModal component for Worker Web.
 * Allows workers to copy task URL and share directly to social media apps.
 */
export default function ShareModal({ task, onClose }) {
  const [copied, setCopied] = useState(false)

  if (!task) return null

  const taskUrl = `${window.location.origin}/tasks/${task.id}`
  const totalPay = (task.pay_rate_per_minute * task.estimated_duration_minutes).toFixed(2)
  const shareTitle = `Check out this task: ${task.title}`
  const shareText = `Check out this task "${task.title}" on FlekxiTask paying RM ${totalPay}!`

  const encodedUrl = encodeURIComponent(taskUrl)
  const encodedText = encodeURIComponent(`${shareText}\n\n${taskUrl}`)

  const handleCopy = () => {
    navigator.clipboard.writeText(taskUrl)
    setCopied(true)
    toast.success('Task link copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  const socialApps = [
    {
      name: 'WhatsApp',
      icon: '💬',
      bgClass: 'bg-[#25D366] hover:bg-[#20bd5a] text-white',
      url: `https://api.whatsapp.com/send?text=${encodedText}`,
    },
    {
      name: 'Messenger',
      icon: '⚡',
      bgClass: 'bg-[#0084FF] hover:bg-[#0073e6] text-white',
      url: `https://www.facebook.com/dialog/send?link=${encodedUrl}&app_id=2962452247149882&redirect_uri=${encodedUrl}`,
      fallbackUrl: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      name: 'Telegram',
      icon: '✈️',
      bgClass: 'bg-[#229ED9] hover:bg-[#1d8cb0] text-white',
      url: `https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent(shareText)}`,
    },
    {
      name: 'Instagram',
      icon: '📸',
      bgClass: 'bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 text-white hover:opacity-95',
      onClick: handleCopy,
      subtitle: 'Copy Link',
    },
    {
      name: 'X (Twitter)',
      icon: '🐦',
      bgClass: 'bg-black hover:bg-gray-800 text-white',
      url: `https://twitter.com/intent/tweet?text=${encodedText}`,
    },
    {
      name: 'Email',
      icon: '✉️',
      bgClass: 'bg-gray-700 hover:bg-gray-800 text-white',
      url: `mailto:?subject=${encodeURIComponent(shareTitle)}&body=${encodedText}`,
    },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5 animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">📤</span>
            <h3 className="font-bold text-gray-900 text-lg">Share Task</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none p-1"
          >
            ✕
          </button>
        </div>

        {/* Task Card Summary */}
        <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-100 flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <p className="font-semibold text-gray-900 text-sm truncate">{task.title}</p>
            <p className="text-xs text-gray-500 mt-0.5">📍 {task.location}</p>
          </div>
          <span className="font-bold text-primary-600 text-base shrink-0">
            RM {totalPay}
          </span>
        </div>

        {/* Task URL & Copy Button */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Task Link URL
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={taskUrl}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-xl text-sm bg-gray-50 text-gray-700 focus:outline-none select-all font-mono"
            />
            <button
              type="button"
              onClick={handleCopy}
              className={`px-4 py-2 text-sm font-semibold rounded-xl transition-colors flex items-center gap-1 shrink-0 ${
                copied
                  ? 'bg-green-600 text-white'
                  : 'bg-primary-600 hover:bg-primary-700 text-white shadow-xs'
              }`}
            >
              {copied ? '✓ Copied' : '📋 Copy'}
            </button>
          </div>
        </div>

        {/* Social Apps Shortcuts */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2.5">
            Share to Social Contact
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            {socialApps.map((app) => (
              app.url ? (
                <a
                  key={app.name}
                  href={app.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all transform active:scale-95 text-xs font-semibold gap-1.5 shadow-xs ${app.bgClass}`}
                >
                  <span className="text-xl">{app.icon}</span>
                  <span className="truncate">{app.name}</span>
                </a>
              ) : (
                <button
                  key={app.name}
                  type="button"
                  onClick={app.onClick}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all transform active:scale-95 text-xs font-semibold gap-1.5 shadow-xs ${app.bgClass}`}
                >
                  <span className="text-xl">{app.icon}</span>
                  <span className="truncate">{app.name}</span>
                </button>
              )
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
