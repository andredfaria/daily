import React from 'react'

export interface WhatsAppProfile {
  name: string | null
  about: string | null
  profilePicUrl: string | null
}

interface Props {
  profile: WhatsAppProfile | null
  whatsappNumber: string | null
  loading: boolean
  error: string | null
  connected?: boolean | null
  compact?: boolean
  onRefresh?: () => void
}

const StatusConexao: React.FC<{ connected: boolean | null }> = ({ connected }) => {
  if (connected === null) {
    return (
      <span className="flex items-center gap-1 text-xs text-on-surface-variant">
        <span className="w-2 h-2 rounded-full bg-outline animate-pulse" />
        Verificando…
      </span>
    )
  }
  return (
    <span className={`flex items-center gap-1 text-xs font-medium ${connected ? 'text-tertiary' : 'text-error'}`}>
      <span className={`w-2 h-2 rounded-full ${connected ? 'bg-tertiary' : 'bg-error'}`} />
      {connected ? 'conectado' : 'desconectado'}
    </span>
  )
}

export const WhatsAppProfileCard: React.FC<Props> = ({
  profile, whatsappNumber, loading, error, connected, compact, onRefresh,
}) => (
  <div className={compact ? 'glass-card rounded-2xl border border-outline-variant/50 p-4' : 'section-card'}>
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">account_circle</span>
        <h3 className="text-base font-semibold text-on-surface">Perfil WhatsApp</h3>
      </div>
      <div className="flex items-center gap-3">
        {connected !== undefined && <StatusConexao connected={connected ?? null} />}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={loading}
            className="btn-ghost text-xs min-h-[44px]"
            aria-label="Atualizar perfil"
          >
            <span className={`material-symbols-outlined text-base ${loading ? 'animate-spin' : ''}`}>refresh</span>
          </button>
        )}
      </div>
    </div>

    {loading ? (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-10 shimmer-bg rounded-xl" />
        ))}
      </div>
    ) : error ? (
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <span className="material-symbols-outlined text-3xl text-on-surface-variant">wifi_off</span>
        <p className="text-sm text-on-surface-variant leading-relaxed">{error}</p>
      </div>
    ) : (
      <div className="flex items-start gap-4">
        {profile?.profilePicUrl ? (
          <img
            src={profile.profilePicUrl}
            alt="Foto de perfil"
            className="w-16 h-16 rounded-full object-cover flex-shrink-0 border border-outline-variant/30"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <span className="material-symbols-outlined text-6xl text-on-surface-variant flex-shrink-0">
            account_circle
          </span>
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold text-on-surface truncate">
            {profile?.name ?? whatsappNumber ?? '-'}
          </p>
          <p className="text-xs text-on-surface-variant">{whatsappNumber ?? '-'}</p>
          {profile?.about && (
            <p className="text-xs text-on-surface-variant italic leading-relaxed mt-1">
              "{profile.about}"
            </p>
          )}
        </div>
      </div>
    )}
  </div>
)
