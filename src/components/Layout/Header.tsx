import React from 'react'
import { useLocation } from 'react-router-dom'

// Resolvido por prefixo porque as páginas com aba têm sub-rota (/contas/lista).
// A aba corrente não entra no título — a TabNav logo abaixo já a mostra.
// A ordem importa: /contas/nova precisa ser testada antes de /contas.
const pageTitles: { prefix: string; title: string }[] = [
  { prefix: '/contas/nova', title: 'Nova Conta' },
  { prefix: '/contas', title: 'Minhas Contas' },
  { prefix: '/ativos', title: 'Meus Ativos' },
  { prefix: '/checklists', title: 'Checklists' },
  { prefix: '/notificacoes', title: 'Notificações' },
  { prefix: '/configuracoes', title: 'Configurações' },
]

const Header: React.FC = () => {
  const location = useLocation()

  const title =
    location.pathname === '/'
      ? 'Home'
      : location.pathname.includes('/editar')
        ? 'Editar Conta'
        : pageTitles.find((p) => location.pathname.startsWith(p.prefix))?.title ?? 'BillSync'

  return (
    <header className="sticky top-0 z-30 bg-surface-container-lowest/80 backdrop-blur-xl border-b border-outline-variant/30 px-4 md:px-6 h-14 md:h-16 flex items-center">
      <h2 className="text-sm md:text-base font-semibold text-on-surface">{title}</h2>
    </header>
  )
}

export default Header
