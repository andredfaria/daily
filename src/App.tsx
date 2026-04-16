import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { ToastProvider } from './context/ToastContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout/Layout'
import Dashboard from './pages/Dashboard'
import Contas from './pages/Contas'
import BillForm from './pages/BillForm'
import Historico from './pages/Historico'
import Configuracoes from './pages/Configuracoes'
import Login from './pages/Login'

// Protects all children — redirects to /login if not authenticated
const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="material-symbols-outlined text-primary text-4xl animate-spin">progress_activity</span>
      </div>
    )
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Outlet />
}

// Prevents authenticated users from seeing the login page
const LoginGuard: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return null
  if (isAuthenticated) return <Navigate to="/" replace />
  return <Login />
}

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginGuard />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/contas" element={<Contas />} />
                <Route path="/contas/nova" element={<BillForm />} />
                <Route path="/contas/:id/editar" element={<BillForm />} />
                <Route path="/historico" element={<Historico />} />
                <Route path="/configuracoes" element={<Configuracoes />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
