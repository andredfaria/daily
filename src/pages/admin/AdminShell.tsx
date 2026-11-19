import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import TabNav from '../../components/ui/TabNav'
import { useAuth } from '../../context/AuthContext'

// Só o dono vê. O backend também barra (403); aqui evita mostrar a tela vazia.
const AdminShell: React.FC = () => {
  const { user } = useAuth()
  if (!user?.is_admin) return <Navigate to="/" replace />
  return (
    <div className="space-y-5 animate-fadeIn">
      <TabNav
        tabs={[
          { to: 'geral', label: 'Visão geral', icon: 'dashboard' },
          { to: 'usuarios', label: 'Usuários', icon: 'group' },
          { to: 'mensagens', label: 'Mensagens', icon: 'chat' },
          { to: 'erros', label: 'Erros', icon: 'error' },
        ]}
      />
      <Outlet />
    </div>
  )
}

export default AdminShell
