import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import CellarPage from './pages/CellarPage'
import PendingPage from './pages/PendingPage'
import StatsPage from './pages/StatsPage'
import WineDetailPage from './pages/WineDetailPage'

function ProtectedRoutes() {
  const { session, loading } = useAuth()

  if (loading) return (
    <div className="flex items-center justify-center min-h-dvh bg-[#1a0505]">
      <div className="w-8 h-8 border-2 border-wine-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!session) return <LoginPage />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<CellarPage />} />
        <Route path="pendientes" element={<PendingPage />} />
        <Route path="estadisticas" element={<StatsPage />} />
        <Route path="vino/:id" element={<WineDetailPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ProtectedRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
