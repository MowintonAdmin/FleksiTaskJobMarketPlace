import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { fetchAdminUser } from './slices/authSlice'
import Sidebar from './components/Sidebar'
import AdminLogin from './pages/AdminLogin'
import Dashboard from './pages/Dashboard'
import Users from './pages/Users'
import AdminUsers from './pages/AdminUsers'
import Tasks from './pages/Tasks'
import Applications from './pages/Applications'
import ActiveWorkers from './pages/ActiveWorkers'
import Withdrawals from './pages/Withdrawals'
import TimeLogs from './pages/TimeLogs'
import Analytics from './pages/Analytics'
import Messages from './pages/Messages'

function AdminRoute({ children }) {
  const { token, user } = useSelector((s) => s.auth)
  if (!token) return <Navigate to="/login" replace />
  if (user && !user.is_admin) return <Navigate to="/login" replace />
  return children
}

function AdminShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Open sidebar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-bold text-gray-800">⚡ FleksiTask Admin</span>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-gray-100">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/users" element={<Users />} />
            <Route path="/admin-users" element={<AdminUsers />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/applications" element={<Applications />} />
            <Route path="/active-workers" element={<ActiveWorkers />} />
            <Route path="/time-logs" element={<TimeLogs />} />
            <Route path="/withdrawals" element={<Withdrawals />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/messages" element={<Messages />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  const dispatch = useDispatch()
  const { token } = useSelector((s) => s.auth)

  useEffect(() => {
    if (token) dispatch(fetchAdminUser())
  }, [token, dispatch])

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<AdminLogin />} />
        <Route path="/*" element={
          <AdminRoute>
            <AdminShell />
          </AdminRoute>
        } />
      </Routes>
      <ToastContainer position="top-right" autoClose={3000} />
    </Router>
  )
}
