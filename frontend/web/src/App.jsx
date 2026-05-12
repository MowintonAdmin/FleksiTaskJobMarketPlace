import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import { fetchCurrentUser } from './store/authSlice'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import ResetPassword from './pages/ResetPassword'
import Messages from './pages/Messages'
import Profile from './pages/Profile'
import TaskDetail from './pages/TaskDetail'
import MyApplications from './pages/MyApplications'
import TaskTracking from './pages/TaskTracking'
import Wallet from './pages/Wallet'
import History from './pages/History'

function PrivateRoute({ children }) {
  const token = useSelector((s) => s.auth.accessToken)
  return token ? children : <Navigate to="/login" replace />
}

export default function App() {
  const dispatch = useDispatch()
  const token = useSelector((s) => s.auth.accessToken)

  useEffect(() => {
    if (token) dispatch(fetchCurrentUser())
  }, [token, dispatch])

  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/tasks/:id" element={<TaskDetail />} />
            <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
            <Route path="/my-applications" element={<PrivateRoute><MyApplications /></PrivateRoute>} />
            <Route path="/messages" element={<PrivateRoute><Messages /></PrivateRoute>} />
            <Route path="/track/:applicationId" element={<PrivateRoute><TaskTracking /></PrivateRoute>} />
            <Route path="/wallet" element={<PrivateRoute><Wallet /></PrivateRoute>} />
            <Route path="/history" element={<PrivateRoute><History /></PrivateRoute>} />
          </Routes>
        </main>
      </div>
      <ToastContainer position="top-right" autoClose={3000} />
    </Router>
  )
}
