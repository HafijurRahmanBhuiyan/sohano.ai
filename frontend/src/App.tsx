import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { getInitialTheme } from './components/ThemeToggle'
import ChatPage from './pages/ChatPage'
import LoginPage from './pages/LoginPage'
import SettingsPage from './pages/SettingsPage'
import SignupPage from './pages/SignupPage'
import { useAuthStore } from './store/auth'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const loadMe = useAuthStore((s) => s.loadMe)
  const initialized = useAuthStore((s) => s.initialized)
  const location = useLocation()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', getInitialTheme() === 'dark')
    loadMe()
  }, [loadMe])

  if (!initialized && location.pathname !== '/login' && location.pathname !== '/signup') {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-zinc-400">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          Loading Sohano.ai…
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={useAuthStore.getState().user ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route
        path="/signup"
        element={useAuthStore.getState().user ? <Navigate to="/" replace /> : <SignupPage />}
      />
      <Route
        path="/settings"
        element={
          <RequireAuth>
            <SettingsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            <ChatPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
