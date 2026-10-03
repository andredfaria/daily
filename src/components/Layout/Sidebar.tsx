import React from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

// short: rótulo da barra inferior do celular, onde sete itens dividem a largura.
const navItems: { path: string; label: string; icon: string; exact?: boolean; short?: string }[] = [
  { path: '/', label: 'Home', icon: 'home', exact: true },
  { path: '/contas', label: 'Contas', icon: 'receipt_long' },
  { path: '/gastos', label: 'Gastos', icon: 'payments' },
  { path: '/ativos', label: 'Ativos', icon: 'trending_up' },
  { path: '/checklists', label: 'Checklists', icon: 'checklist' },
  { path: '/notificacoes', label: 'Notificações', icon: 'notifications', short: 'Avisos' },
  { path: '/configuracoes', label: 'Configurações', icon: 'settings', short: 'Ajustes' },
]

export { navItems }

const Sidebar: React.FC = () => {
  const { logout } = useAuth()

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-screen w-[220px] bg-surface-container-lowest border-r border-outline-variant/50 flex-col z-40">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-outline-variant/30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-on-primary-fixed text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
              event_repeat
            </span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-on-surface leading-none">Rotina</h1>
            <p className="text-[10px] text-on-surface-variant mt-0.5">Gestão do Dia a Dia</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.exact}
            className={({ isActive }) =>
              `nav-link ${isActive ? 'active' : ''}`
            }
          >
            <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-outline-variant/30">
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-error hover:bg-error/10 transition-colors"
        >
          <span className="material-symbols-outlined text-lg">logout</span>
          Sair
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
