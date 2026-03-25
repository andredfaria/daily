import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from './context/ToastContext'
import Layout from './components/Layout/Layout'
import Dashboard from './pages/Dashboard'
import Contas from './pages/Contas'
import BillForm from './pages/BillForm'
import Historico from './pages/Historico'
import Configuracoes from './pages/Configuracoes'

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ToastProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/contas" element={<Contas />} />
            <Route path="/contas/nova" element={<BillForm />} />
            <Route path="/contas/:id/editar" element={<BillForm />} />
            <Route path="/historico" element={<Historico />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App
