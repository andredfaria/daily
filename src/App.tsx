import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { ToastProvider } from './context/ToastContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout/Layout'
import Home from './pages/Home'
import ContasShell from './pages/contas/ContasShell'
import ContasLista from './pages/contas/ContasLista'
import ContasAnalise from './pages/contas/ContasAnalise'
import ContasHistorico from './pages/contas/ContasHistorico'
import Gastos from './pages/gastos/Gastos'
import ComoUsar from './pages/ComoUsar'
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
import AdminShell from './pages/admin/AdminShell'
import AdminGeral from './pages/admin/AdminGeral'
import AdminUsuarios from './pages/admin/AdminUsuarios'
import AdminUsuario from './pages/admin/AdminUsuario'
import AdminMensagens from './pages/admin/AdminMensagens'
import AdminErros from './pages/admin/AdminErros'
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
                <Route path="/" element={<Home />} />
                <Route path="/contas" element={<ContasShell />}>
                  <Route index element={<Navigate to="lista" replace />} />
                  <Route path="lista" element={<ContasLista />} />
                  {/* Gastos virou página própria; o endereço antigo continua chegando lá. */}
                  <Route path="gastos" element={<Navigate to="/gastos" replace />} />
                  <Route path="analise" element={<ContasAnalise />} />
                  <Route path="historico" element={<ContasHistorico />} />
                </Route>
                <Route path="/gastos" element={<Gastos />} />
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
                <Route path="/admin" element={<AdminShell />}>
                  <Route index element={<Navigate to="geral" replace />} />
                  <Route path="geral" element={<AdminGeral />} />
                  <Route path="usuarios" element={<AdminUsuarios />} />
                  <Route path="usuarios/:id" element={<AdminUsuario />} />
                  <Route path="mensagens" element={<AdminMensagens />} />
                  <Route path="erros" element={<AdminErros />} />
                </Route>
                <Route path="/notificacoes" element={<Notificacoes />} />
                <Route path="/configuracoes" element={<Configuracoes />} />
                <Route path="/como-usar" element={<ComoUsar />} />
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
