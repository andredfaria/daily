import React from 'react'
import { Link, useLocation } from 'react-router-dom'

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
  { prefix: '/como-usar', title: 'Como usar' },
]

const Header: React.FC = () => {
  const location = useLocation()

  const title =
    location.pathname === '/'
      ? 'Home'
      : location.pathname.includes('/editar')
        ? 'Editar Conta'
        : pageTitles.find((p) => location.pathname.startsWith(p.prefix))?.title ?? 'Rotina'

  return (
    <header className="sticky top-0 z-30 bg-surface-container-lowest/80 backdrop-blur-xl border-b border-outline-variant/30 px-4 md:px-6 h-14 md:h-16 flex items-center justify-between gap-3">
      <h2 className="text-sm md:text-base font-semibold text-on-surface">{title}</h2>
      {/* Fora da navegação principal: o BottomNav já está cheio no mobile. */}
      {location.pathname !== '/como-usar' && (
        <Link
          to="/como-usar"
          className="w-11 h-11 -mr-2 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors"
          title="Como usar"
          aria-label="Como usar o Rotina"
        >
          <span className="material-symbols-outlined">help</span>
        </Link>
      )}
    </header>
  )
}

export default Header
