import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { ToastProvider } from './context/ToastContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout/Layout'
import Dashboard from './pages/Dashboard'
import ContasShell from './pages/contas/ContasShell'
import ContasLista from './pages/contas/ContasLista'
import ContasAnalise from './pages/contas/ContasAnalise'
import BillForm from './pages/BillForm'
import Notificacoes from './pages/Notificacoes'
import Configuracoes from './pages/Configuracoes'
import Login from './pages/Login'
import ChecklistsShell from './pages/checklists/ChecklistsShell'
import ChecklistsLista from './pages/checklists/ChecklistsLista'
import ChecklistsAnalise from './pages/checklists/ChecklistsAnalise'
import AtivosShell from './pages/ativos/AtivosShell'
import AtivosCarteira from './pages/ativos/AtivosCarteira'
import AtivosAnalise from './pages/ativos/AtivosAnalise'
// Protects all children — redirects to /login if not authenticated
const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
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
                <Route path="/contas" element={<ContasShell />}>
                  <Route index element={<Navigate to="lista" replace />} />
                  <Route path="lista" element={<ContasLista />} />
                  <Route path="analise" element={<ContasAnalise />} />
                </Route>
                <Route path="/ativos" element={<AtivosShell />}>
                  <Route index element={<Navigate to="carteira" replace />} />
                  <Route path="carteira" element={<AtivosCarteira />} />
                  <Route path="analise" element={<AtivosAnalise />} />
                </Route>
                <Route path="/contas/nova" element={<BillForm />} />
                <Route path="/contas/:id/editar" element={<BillForm />} />
                <Route path="/checklists" element={<ChecklistsShell />}>
                  <Route index element={<Navigate to="lista" replace />} />
                  <Route path="lista" element={<ChecklistsLista />} />
                  <Route path="analise" element={<ChecklistsAnalise />} />
                </Route>
                <Route path="/notificacoes" element={<Notificacoes />} />
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
