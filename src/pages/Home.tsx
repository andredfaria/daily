import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { occurrencesApi } from '../api/occurrences'
import { checklistsApi } from '../api/checklists'
import { assetsApi } from '../api/assets'
import { notificationsApi } from '../api/notifications'
import wahaApi from '../api/waha'
import type { BillOccurrence, ChecklistDashboardData, AssetWithQuote } from '../types'
import { formatBRL, formatDate, formatRelativeDate, getBillIcon } from '../utils/format'
import { SkeletonRow } from '../components/ui/Skeleton'
import { WhatsAppProfileCard, WhatsAppProfile } from '../components/whatsapp/WhatsAppProfileCard'
import { useAuth } from '../context/AuthContext'
import { parseISO, isToday, isTomorrow } from 'date-fns'

interface Pendencia {
  icone: string
  texto: string
  destino: string
}

const OccurrenceRow: React.FC<{ occurrence: BillOccurrence }> = ({ occurrence }) => {
  const { label, color } = formatRelativeDate(occurrence.due_date)
  const icon = getBillIcon(occurrence.bill_name ?? occurrence.bill?.name ?? '')
  const billName = occurrence.bill_name ?? occurrence.bill?.name ?? 'Sem nome'

  return (
    <div className="p-3 sm:p-4 rounded-xl border bg-surface-container/50 hover:bg-surface-container transition-all duration-200 border-outline-variant/40">
      <div className="flex items-center gap-3">
        <div className="w-1 h-10 rounded-full flex-shrink-0 bg-primary/40" />
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-primary text-lg">{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-on-surface truncate">{billName}</p>
          <p className={`text-xs ${color} font-medium`}>
            {formatDate(occurrence.due_date)} · {label}
          </p>
        </div>
        <p className="text-sm font-bold text-on-surface flex-shrink-0">{formatBRL(occurrence.amount)}</p>
      </div>
    </div>
  )
}

const Home: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [occurrences, setOccurrences] = useState<BillOccurrence[]>([])
  const [checklist, setChecklist] = useState<ChecklistDashboardData | null>(null)
  const [ativos, setAtivos] = useState<AssetWithQuote[]>([])
  const [profile, setProfile] = useState<WhatsAppProfile | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [connected, setConnected] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingProfile, setLoadingProfile] = useState(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    setLoadingProfile(true)
    setProfileError(null)

    // allSettled em tudo: o WAHA fora do ar não pode esconder os vencimentos.
    const [occR, checkR, ativosR, profileR, conexaoR] = await Promise.allSettled([
      occurrencesApi.upcoming(30),
      checklistsApi.dashboard(),
      assetsApi.list(),
      notificationsApi.getWhatsAppProfile(),
      wahaApi.getStatus(),
    ])

    if (occR.status === 'fulfilled') setOccurrences(occR.value)
    if (checkR.status === 'fulfilled') setChecklist(checkR.value)
    if (ativosR.status === 'fulfilled') setAtivos(ativosR.value)

    if (profileR.status === 'fulfilled') {
      setProfile(profileR.value)
    } else {
      const err: any = profileR.reason
      setProfileError(err?.response?.data?.error ?? err?.message ?? 'Erro ao buscar perfil WhatsApp.')
    }

    // getStatus devolve { connected, status } — o booleano está no campo connected.
    setConnected(conexaoR.status === 'fulfilled' ? conexaoR.value.connected : false)
    setLoadingProfile(false)
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  // Não há estado de pagamento em bill_occurrences (a migration 010 removeu
  // status/paid_at), então a pendência de conta é apenas a data de vencimento.
  const pendencias: Pendencia[] = []

  for (const occ of occurrences) {
    const vencimento = parseISO(occ.due_date)
    if (isToday(vencimento) || isTomorrow(vencimento)) {
      pendencias.push({
        icone: getBillIcon(occ.bill_name ?? ''),
        texto: `${occ.bill_name ?? 'Conta'} · ${formatBRL(occ.amount)} · vence ${isToday(vencimento) ? 'hoje' : 'amanhã'}`,
        destino: '/contas/lista',
      })
    }
  }

  const hoje = checklist?.today
  if (checklist?.checklist && hoje && hoje.completion_pct < 100) {
    pendencias.push({
      icone: 'checklist',
      texto: `Checklist de hoje em ${hoje.completion_pct}%`,
      destino: '/checklists/lista',
    })
  }

  for (const a of ativos) {
    if (a.target_triggered_at !== null || a.stop_triggered_at !== null) {
      pendencias.push({
        icone: a.target_triggered_at !== null ? 'flag' : 'shield',
        texto: `${a.ticker} bateu o ${a.target_triggered_at !== null ? 'alvo' : 'stop'} · alerta pausado`,
        destino: '/ativos/carteira',
      })
    }
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <WhatsAppProfileCard
        profile={profile}
        whatsappNumber={user?.whatsapp_number ?? null}
        loading={loadingProfile}
        error={profileError}
        connected={connected}
        compact
      />

      {!loading && pendencias.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-primary">priority_high</span>
            Precisa de você hoje
          </p>
          <div className="space-y-2">
            {pendencias.map((p, i) => (
              <button
                key={`${p.destino}-${i}`}
                onClick={() => navigate(p.destino)}
                className="w-full flex items-center gap-3 p-3 min-h-[56px] rounded-xl bg-surface-container/50 hover:bg-surface-container border border-outline-variant/40 transition-colors text-left"
              >
                <span className="material-symbols-outlined text-primary text-lg flex-shrink-0">{p.icone}</span>
                <span className="text-sm text-on-surface flex-1 min-w-0 truncate">{p.texto}</span>
                <span className="material-symbols-outlined text-on-surface-variant text-lg flex-shrink-0">chevron_right</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-on-surface">Próximos Vencimentos</h3>
          <button
            onClick={() => navigate('/notificacoes')}
            className="text-xs text-primary hover:text-primary/80 font-medium transition-colors min-h-[44px]"
          >
            Ver notificações →
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : occurrences.length === 0 ? (
          <div className="glass-card rounded-2xl border border-outline-variant/50 p-12 text-center">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-3 block">celebration</span>
            <p className="text-on-surface font-semibold mb-1">Tudo em dia!</p>
            <p className="text-sm text-on-surface-variant">Nenhum vencimento próximo.</p>
            <button onClick={() => navigate('/contas/nova')} className="btn-primary mx-auto mt-4">
              <span className="material-symbols-outlined text-lg">add</span>
              Adicionar Conta
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {occurrences.map((occ) => <OccurrenceRow key={occ.id} occurrence={occ} />)}
          </div>
        )}
      </div>
    </div>
  )
}

export default Home
