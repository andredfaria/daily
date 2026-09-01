import React from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import Sidebar, { navItems } from './Sidebar'
import Header from './Header'

const BottomNav: React.FC = () => {
  // Sem botão Sair: ação destrutiva não divide barra com navegação, e a largura
  // liberada deixa os seis rótulos legíveis no mobile. Sair vive em Configurações.
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-container-lowest border-t border-outline-variant/50 flex items-stretch">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.exact}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[9px] font-medium transition-colors min-h-[56px] ${
              isActive ? 'text-primary' : 'text-on-surface-variant'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span
                className="material-symbols-outlined text-[22px]"
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {item.icon}
              </span>
              <span className="leading-none">{item.label.split(' ')[0]}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

const Layout: React.FC = () => {
  return (
    <div className="min-h-dvh bg-background flex">
      <Sidebar />

      {/* Content area: no left margin on mobile, 220px on md+ */}
      <div className="flex-1 md:ml-[220px] flex flex-col min-h-dvh">
        <Header />

        {/* Extra bottom padding on mobile to clear the bottom nav */}
        <main className="flex-1 p-4 md:p-6 pb-[76px] md:pb-6">
          <Outlet />
        </main>

        <footer className="hidden md:block text-center text-[11px] text-on-surface-variant/50 py-3 border-t border-outline-variant/20 select-none">
          BillSync v1.0.0 · Gestão do Dia a Dia
        </footer>
      </div>

      <BottomNav />
    </div>
  )
}

export default Layout
