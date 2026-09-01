import React, { useEffect, useState } from 'react'
import { nomeExibicao, mostrarNomeSalvo } from '../../utils/whatsappProfile'

export interface WhatsAppProfile {
  pushName: string | null
  savedName: string | null
  profilePicUrl: string | null
  numberExists: boolean | null
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

// A URL da foto do WhatsApp expira, então uma imagem pode quebrar a qualquer
// momento. Trocar por estado (em vez de esconder o <img> no onError) mantém a
// caixa do mesmo tamanho e evita o buraco de layout que o card antigo deixava.
const Avatar: React.FC<{ url: string | null; tamanho: string }> = ({ url, tamanho }) => {
  const [quebrou, setQuebrou] = useState(false)

  useEffect(() => { setQuebrou(false) }, [url])

  const base = `${tamanho} rounded-full flex-shrink-0 border border-outline-variant/30`

  if (!url || quebrou) {
    return (
      <div className={`${base} bg-surface-container-high flex items-center justify-center`} aria-hidden="true">
        <span className="material-symbols-outlined text-on-surface-variant">account_circle</span>
      </div>
    )
  }

  return (
    <img
      src={url}
      alt="Foto de perfil do WhatsApp"
      className={`${base} object-cover`}
      onError={() => setQuebrou(true)}
    />
  )
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

// Cor nunca é o único sinal: o selo carrega ícone e texto, para funcionar em
// leitor de tela e para quem não distingue verde de vermelho.
const SeloNumero: React.FC<{ existe: boolean | null }> = ({ existe }) => {
  if (existe === null) return null
  return existe ? (
    <span className="flex items-center gap-1 text-xs text-tertiary">
      <span className="material-symbols-outlined text-sm">verified</span>
      Número ativo no WhatsApp
    </span>
  ) : (
    <span className="flex items-center gap-1 text-xs text-error">
      <span className="material-symbols-outlined text-sm">error</span>
      Número não encontrado no WhatsApp
    </span>
  )
}

export const WhatsAppProfileCard: React.FC<Props> = ({
  profile, whatsappNumber, loading, error, connected, compact, onRefresh,
}) => {
  const exibido = nomeExibicao(profile?.pushName ?? null, profile?.savedName ?? null, whatsappNumber)
  const salvo = mostrarNomeSalvo(exibido, profile?.savedName ?? null)

  return (
    <div className={compact ? 'glass-card rounded-2xl border border-outline-variant/50 p-4' : 'section-card'}>
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-primary">account_circle</span>
          <h3 className="text-base font-semibold text-on-surface truncate">Perfil WhatsApp</h3>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {connected !== undefined && <StatusConexao connected={connected ?? null} />}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50"
              aria-label="Atualizar perfil do WhatsApp"
            >
              <span className={`material-symbols-outlined text-base ${loading ? 'animate-spin' : ''}`}>refresh</span>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        // Esqueleto no mesmo formato do conteúdo, para a altura não saltar quando carregar.
        <div className="flex items-start gap-4">
          <div className={`${compact ? 'w-14 h-14' : 'w-16 h-16'} rounded-full shimmer-bg flex-shrink-0`} />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-4 w-40 max-w-full shimmer-bg rounded" />
            <div className="h-3 w-32 max-w-full shimmer-bg rounded" />
          </div>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <span className="material-symbols-outlined text-3xl text-on-surface-variant">wifi_off</span>
          <p className="text-sm text-on-surface-variant leading-relaxed">{error}</p>
        </div>
      ) : (
        <div className="flex items-start gap-4">
          <Avatar url={profile?.profilePicUrl ?? null} tamanho={compact ? 'w-14 h-14' : 'w-16 h-16'} />

          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-semibold text-on-surface truncate">{exibido}</p>
            <p className="text-xs text-on-surface-variant tabular-nums">{whatsappNumber ?? '—'}</p>
            <SeloNumero existe={profile?.numberExists ?? null} />
            {!compact && salvo && (
              <p className="text-xs text-on-surface-variant/70 truncate">
                Salvo como "{salvo}"
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
