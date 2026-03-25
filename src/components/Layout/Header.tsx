import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { notificationsApi } from '../../api/notifications'

const pageTitles: Record<string, string> = {
  '/': 'Dashboard',
  '/contas': 'Contas',
  '/contas/nova': 'Nova Conta',
  '/historico': 'Histórico',
  '/configuracoes': 'Configurações',
}

const Header: React.FC = () => {
  const location = useLocation()
  const [wahaConnected, setWahaConnected] = useState<boolean | null>(null)
  const [notifCount, setNotifCount] = useState(0)

  const title =
    pageTitles[location.pathname] ||
    (location.pathname.includes('/editar') ? 'Editar Conta' : 'BillSync')

  useEffect(() => {
    let cancelled = false

    const fetchStatus = async () => {
      try {
        const status = await notificationsApi.getWahaStatus()
        if (!cancelled) setWahaConnected(status.connected)
      } catch {
        if (!cancelled) setWahaConnected(false)
      }
    }

    const fetchNotifs = async () => {
      try {
        const notifs = await notificationsApi.dueToday()
        if (!cancelled) setNotifCount(notifs.length)
      } catch {
        // silent
      }
    }

    fetchStatus()
    fetchNotifs()

    const interval = setInterval(fetchStatus, 30000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  return (
    <header className="sticky top-0 z-30 bg-surface-container-lowest/80 backdrop-blur-xl border-b border-outline-variant/30 px-6 h-16 flex items-center justify-between">
      <h2 className="text-base font-semibold text-on-surface">{title}</h2>

      <div className="flex items-center gap-3">
        {/* WAHA Status */}
        <div
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border
            ${wahaConnected === true
              ? 'bg-tertiary/10 text-tertiary border-tertiary/30'
              : wahaConnected === false
              ? 'bg-error/10 text-error border-error/30'
              : 'bg-outline/10 text-outline border-outline/30'
            }
          `}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              wahaConnected === true
                ? 'bg-tertiary animate-pulse'
                : wahaConnected === false
                ? 'bg-error'
                : 'bg-outline'
            }`}
          />
          <span className="material-symbols-outlined text-sm">chat</span>
          {wahaConnected === null ? 'Verificando...' : wahaConnected ? 'WAHA Online' : 'WAHA Offline'}
        </div>

        {/* Notifications Bell */}
        <button className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-surface-container-high transition-colors text-on-surface-variant hover:text-on-surface">
          <span className="material-symbols-outlined text-xl">notifications</span>
          {notifCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-error text-on-error text-[9px] font-bold rounded-full flex items-center justify-center">
              {notifCount > 9 ? '9+' : notifCount}
            </span>
          )}
        </button>

        {/* User Avatar */}
        <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-lg">person</span>
        </div>
      </div>
    </header>
  )
}

export default Header
