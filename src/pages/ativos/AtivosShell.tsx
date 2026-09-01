import React from 'react'
import { Outlet } from 'react-router-dom'
import TabNav from '../../components/ui/TabNav'

const AtivosShell: React.FC = () => (
  <div className="space-y-5 animate-fadeIn">
    <TabNav
      tabs={[
        { to: 'carteira', label: 'Carteira', icon: 'account_balance_wallet' },
        { to: 'analise', label: 'Análise', icon: 'monitoring' },
      ]}
    />
    <Outlet />
  </div>
)

export default AtivosShell
