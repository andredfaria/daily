import React from 'react'
import { Outlet } from 'react-router-dom'
import TabNav from '../../components/ui/TabNav'

const ContasShell: React.FC = () => (
  <div className="space-y-5 animate-fadeIn">
    <TabNav
      tabs={[
        { to: 'lista', label: 'Contas', icon: 'receipt_long' },
        { to: 'analise', label: 'Análise', icon: 'monitoring' },
      ]}
    />
    <Outlet />
  </div>
)

export default ContasShell
