import React from 'react'
import { useLocation } from 'react-router-dom'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/contas': 'Minhas Contas',
  '/contas/nova': 'Nova Conta',
  '/ativos': 'Meus Ativos',
  '/checklists': 'Checklists',
  '/notificacoes': 'Notificações',
  '/historico': 'Histórico',
  '/configuracoes': 'Configurações',
}

const Header: React.FC = () => {
  const location = useLocation()

  const title =
    pageTitles[location.pathname] ||
    (location.pathname.includes('/editar') ? 'Editar Conta' : 'BillSync')

  return (
    <header className="sticky top-0 z-30 bg-surface-container-lowest/80 backdrop-blur-xl border-b border-outline-variant/30 px-4 md:px-6 h-14 md:h-16 flex items-center">
      <h2 className="text-sm md:text-base font-semibold text-on-surface">{title}</h2>
    </header>
  )
}

export default Header
