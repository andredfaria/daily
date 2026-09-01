import React from 'react'
import { NavLink } from 'react-router-dom'

export interface TabItem {
  to: string
  label: string
  icon: string
}

// Barra de abas das páginas com análise. O estado ativo vem da URL via NavLink —
// sem useState, e por isso sobrevive a recarregar a página.
const TabNav: React.FC<{ tabs: TabItem[] }> = ({ tabs }) => (
  <nav className="flex gap-2 overflow-x-auto no-scrollbar" aria-label="Seções da página">
    {tabs.map((tab) => (
      <NavLink
        key={tab.to}
        to={tab.to}
        className={({ isActive }) =>
          `flex items-center gap-1.5 flex-shrink-0 min-h-[44px] px-4 rounded-full text-sm font-medium transition-colors ${
            isActive
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
          }`
        }
      >
        <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
        {tab.label}
      </NavLink>
    ))}
  </nav>
)

export default TabNav
