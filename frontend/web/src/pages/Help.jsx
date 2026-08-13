import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'

const GUIDES = [
  {
    id: 'getting-started',
    category: '🚀 Getting Started & Profile',
    title: 'Account Registration & Profile Setup',
    description: 'Learn how to register your account, complete your profile, and submit KYC verification.',
    steps: [
      {
        title: '1. Register & Login',
        content: 'Create your account using your email and password, or sign in instantly with your Google Account.',
      },
      {
        title: '2. Complete Required Profile Info',
        content: 'Go to Profile page and fill in your Full Name, Phone Number, NRIC/Passport Number, Height, Academic Qualification, and Nationality.',
      },
      {
        title: '3. Submit Identity Verification (KYC)',
        content: 'Upload a clear photo of the front of your NRIC/Passport, and a selfie holding your ID. Once submitted, our admins will verify your profile within 24 hours.',
      },
    ],
  },
  {
    id: 'applying-work',
    category: '📝 Finding & Applying for Work',
    title: 'Browse Available Tasks & Submit Applications',
    description: 'Find flexible gig opportunities near your location and apply in one tap.',
    steps: [
      {
        title: '1. Filter Tasks by Location & Category',
        content: 'On the Home page, use the search filter bar to filter tasks by City/Area (e.g. Puchong, Pinang), Category, or Pay Rate.',
      },
      {
        title: '2. Check Task Requirements',
        content: 'Click on any task to view estimated duration, pay rate per hour/minute, work description, and employer location.',
      },
      {
        title: '3. Apply & Track Status',
        content: 'Click "Apply Now". Check your "My Applications" tab to see when your application status changes to Approved.',
      },
    ],
  },
  {
    id: 'task-tracking',
    category: '⏱️ Task Tracking & Check-In',
    title: 'How to Check-In, Track Hours, and Complete Work',
    description: 'Start your shift, monitor working time, and submit proof photos upon completion.',
    steps: [
      {
        title: '1. Access Task Tracking',
        content: 'Once your application is Approved, go to "My Applications" and click "Track Task" to open the live tracking workspace.',
      },
      {
        title: '2. Start Shift (Check-In)',
        content: 'Click "Check In" to record your starting location and timestamp. The live timer will start counting your active shift.',
      },
      {
        title: '3. End Shift & Submit Proof (Check-Out)',
        content: 'When your work is done, click "Check Out". Upload a photo proof of your completed work, add any notes, and submit for admin approval.',
      },
    ],
  },
  {
    id: 'wallet-withdrawals',
    category: '💸 Earnings & Wallet Payouts',
    title: 'Wallet Balance, QR Code Setup & Cash Withdrawal',
    description: 'Understand how task earnings are calculated and how to withdraw funds to your bank account.',
    steps: [
      {
        title: '1. Task Pay Calculation',
        content: 'All tasks pay a fixed estimated duration rate (e.g. RM 20/hr × 2 hours = RM 40.00). Once approved, funds are added to your My Wallet balance.',
      },
      {
        title: '2. Upload Bank DuitNow QR Code',
        content: 'Go to Profile page and upload your Bank DuitNow QR code image so admins can quickly transfer payouts directly to your account.',
      },
      {
        title: '3. Request Payout',
        content: 'Go to "Wallet" page and click "Withdraw". Enter the amount (minimum RM 10.00) and submit. Admin processes payouts within 1-3 business days.',
      },
    ],
  },
]

const FAQS = [
  {
    q: 'How long does identity (KYC) verification take?',
    a: 'Admins review all submitted ID documents within 24 hours. You can check your status on the Profile page.',
  },
  {
    q: 'How are task earnings calculated?',
    a: 'Tasks use fixed total pay based on estimated duration (Pay Rate × Estimated Duration). Once your check-out proof is approved by admin, full payment is credited to your wallet.',
  },
  {
    q: 'When will I receive my withdrawal payout?',
    a: 'Withdrawal requests are processed by admins within 1-3 business days and transferred via DuitNow directly to your registered bank account or QR code.',
  },
  {
    q: 'What should I do if I cannot upload a proof photo during check-out?',
    a: 'You can use the simple check-out mode to log your shift, and send a message to the task manager via the Messages tab to provide details.',
  },
]

export default function Help() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [openFaqIndex, setOpenFaqIndex] = useState(null)

  const filteredGuides = useMemo(() => {
    return GUIDES.filter((g) => {
      const matchCat = activeCategory === 'all' || g.id === activeCategory
      const s = search.toLowerCase().trim()
      if (!s) return matchCat
      const matchSearch =
        g.title.toLowerCase().includes(s) ||
        g.description.toLowerCase().includes(s) ||
        g.steps.some((st) => st.title.toLowerCase().includes(s) || st.content.toLowerCase().includes(s))
      return matchCat && matchSearch
    })
  }, [activeCategory, search])

  const filteredFaqs = useMemo(() => {
    const s = search.toLowerCase().trim()
    if (!s) return FAQS
    return FAQS.filter((f) => f.q.toLowerCase().includes(s) || f.a.toLowerCase().includes(s))
  }, [search])

  return (
    <div className="min-h-screen bg-gray-50/50 pb-16">
      {/* Search Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 text-white py-12 px-4 shadow-md">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-semibold text-blue-100 border border-white/20">
            <span>📚 FleksiTask Documentation & User Guide</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            How can we help you today?
          </h1>
          <p className="text-blue-100 text-sm sm:text-base max-w-xl mx-auto">
            Search step-by-step guides, check-in instructions, payout FAQs, and profile setup tutorials.
          </p>

          {/* Instant Search Input */}
          <div className="pt-2 max-w-2xl mx-auto relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search guides, check-in, wallet, KYC, payouts…"
              className="w-full pl-11 pr-4 py-3.5 rounded-2xl text-gray-900 placeholder-gray-400 bg-white shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-300 text-sm font-medium transition-all"
            />
            <svg
              className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-4 pt-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Filter Navigation */}
        <div className="lg:col-span-1 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 px-3">Documentation Index</p>
          <button
            onClick={() => setActiveCategory('all')}
            className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center justify-between ${
              activeCategory === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-700 hover:bg-gray-200/60'
            }`}
          >
            <span>📖 All Guides</span>
            <span className="text-xs opacity-75">{GUIDES.length}</span>
          </button>

          {GUIDES.map((g) => (
            <button
              key={g.id}
              onClick={() => setActiveCategory(g.id)}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                activeCategory === g.id
                  ? 'bg-blue-600 text-white shadow-sm font-semibold'
                  : 'text-gray-600 hover:bg-gray-200/60'
              }`}
            >
              <p className="truncate">{g.category}</p>
            </button>
          ))}

          <div className="pt-6 px-3 border-t border-gray-200 mt-6 space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Need Live Support?</p>
            <a
              href="https://wa.me/60108282060"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs font-bold text-green-700 bg-green-50 border border-green-200 p-3 rounded-xl hover:bg-green-100 transition-colors"
            >
              <span>💬 Chat with Support on WhatsApp</span>
            </a>
          </div>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3 space-y-8">
          {filteredGuides.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 shadow-sm space-y-3">
              <p className="text-3xl">🔍</p>
              <p className="text-gray-800 font-bold">No documentation found for "{search}"</p>
              <p className="text-xs text-gray-500">Try searching for keywords like "KYC", "check-in", "wallet", or "apply".</p>
              <button
                onClick={() => { setSearch(''); setActiveCategory('all') }}
                className="mt-2 text-xs font-semibold text-blue-600 hover:underline"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            filteredGuides.map((guide) => (
              <div key={guide.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden transition-all hover:shadow-md">
                <div className="bg-gradient-to-r from-gray-50 to-blue-50/30 px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-700 bg-blue-100/80 px-2.5 py-1 rounded-lg">
                    {guide.category}
                  </span>
                </div>

                <div className="p-6 space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{guide.title}</h2>
                    <p className="text-sm text-gray-500 mt-1">{guide.description}</p>
                  </div>

                  <div className="space-y-4">
                    {guide.steps.map((step, idx) => (
                      <div key={idx} className="flex gap-4 p-4 rounded-xl bg-gray-50/80 border border-gray-100">
                        <div className="flex-1 space-y-1">
                          <p className="font-bold text-sm text-gray-900">{step.title}</p>
                          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">{step.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))
          )}

          {/* FAQ Accordion Section */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <span>❓ Frequently Asked Questions (FAQ)</span>
              </h2>
              <span className="text-xs font-medium text-gray-400">{filteredFaqs.length} Questions</span>
            </div>

            <div className="divide-y divide-gray-100">
              {filteredFaqs.map((faq, idx) => {
                const isOpen = openFaqIndex === idx
                return (
                  <div key={idx} className="py-3.5">
                    <button
                      onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                      className="w-full text-left flex items-center justify-between gap-4 group"
                    >
                      <span className="font-semibold text-sm text-gray-800 group-hover:text-blue-600 transition-colors">
                        {faq.q}
                      </span>
                      <span className="text-gray-400 font-bold text-sm">
                        {isOpen ? '−' : '+'}
                      </span>
                    </button>
                    {isOpen && (
                      <div className="mt-2.5 text-xs sm:text-sm text-gray-600 leading-relaxed pl-1 pr-4 bg-blue-50/40 p-3 rounded-xl border border-blue-100/60">
                        {faq.a}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
