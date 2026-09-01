import React from 'react'
import { Outlet } from 'react-router-dom'
import TabNav from '../../components/ui/TabNav'

const ChecklistsShell: React.FC = () => (
  <div className="space-y-5 animate-fadeIn">
    <TabNav
      tabs={[
        { to: 'lista', label: 'Checklists', icon: 'checklist' },
        { to: 'analise', label: 'Análise', icon: 'monitoring' },
      ]}
    />
    <Outlet />
  </div>
)

export default ChecklistsShell
