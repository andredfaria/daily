import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { occurrencesApi } from '../api/occurrences'
import { checklistsApi } from '../api/checklists'
import { assetsApi } from '../api/assets'
import { notificationsApi } from '../api/notifications'
import { expensesApi } from '../api/expenses'
import wahaApi from '../api/waha'
import type { BillOccurrence, ChecklistDashboardData, AssetWithQuote, ExpensesResponse } from '../types'
import { formatBRL, formatDate, formatRelativeDate, getBillIcon } from '../utils/format'
import { SkeletonRow } from '../components/ui/Skeleton'
import { WhatsAppProfileCard, WhatsAppProfile } from '../components/whatsapp/WhatsAppProfileCard'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { parseISO, isToday, isTomorrow } from 'date-fns'

function mesAtualSaoPaulo(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit',
  }).formatToParts(new Date())
  const ano = parts.find((p) => p.type === 'year')?.value ?? '2000'
  const mes = parts.find((p) => p.type === 'month')?.value ?? '01'
  return `${ano}-${mes}`
}

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
  const [gastos, setGastos] = useState<ExpensesResponse | null>(null)
  const [gastosErro, setGastosErro] = useState(false)
  const [ativos, setAtivos] = useState<AssetWithQuote[]>([])
  const [profile, setProfile] = useState<WhatsAppProfile | null>(null)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [connected, setConnected] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [marcandoItem, setMarcandoItem] = useState<string | null>(null)
  const [enviandoChecklist, setEnviandoChecklist] = useState(false)
  const { success, error: showError } = useToast()

  const carregar = useCallback(async () => {
    setLoading(true)
    setLoadingProfile(true)
    setProfileError(null)

    // allSettled em tudo: o WAHA fora do ar não pode esconder os vencimentos.
    const [occR, checkR, ativosR, profileR, conexaoR, gastosR] = await Promise.allSettled([
      occurrencesApi.upcoming(30),
      checklistsApi.dashboard(),
      assetsApi.list(),
      notificationsApi.getWhatsAppProfile(),
      wahaApi.getStatus(),
      expensesApi.list(mesAtualSaoPaulo()),
    ])

    if (occR.status === 'fulfilled') setOccurrences(occR.value)
    if (checkR.status === 'fulfilled') setChecklist(checkR.value)
    if (ativosR.status === 'fulfilled') setAtivos(ativosR.value)
    if (gastosR.status === 'fulfilled') {
      setGastos(gastosR.value)
      setGastosErro(false)
    } else {
      setGastosErro(true)
    }

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

  const marcarItem = async (texto: string) => {
    if (!checklist?.checklist || !checklist.today || marcandoItem) return
    setMarcandoItem(texto)
    try {
      const updated = await checklistsApi.markToday(checklist.checklist.id, texto)
      setChecklist((prev) => prev?.today ? { ...prev, today: { ...prev.today, ...updated } } : prev)
      success('Item marcado.')
    } catch {
      showError('Não foi possível marcar o item.')
    } finally {
      setMarcandoItem(null)
    }
  }

  const enviarChecklist = async () => {
    if (!checklist?.checklist || enviandoChecklist) return
    setEnviandoChecklist(true)
    try {
      await checklistsApi.sendNow(false, checklist.checklist.id)
      const updated = await checklistsApi.dashboard(checklist.checklist.id)
      setChecklist(updated)
      success('Checklist enviado para o WhatsApp.')
    } catch {
      showError('Não foi possível enviar o checklist.')
    } finally {
      setEnviandoChecklist(false)
    }
  }

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

      <section className="glass-card rounded-2xl border border-outline-variant/50 p-5" aria-labelledby="gastos-mes-titulo">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p id="gastos-mes-titulo" className="text-sm font-semibold text-on-surface">Gastos neste mês</p>
            {loading ? (
              <div className="mt-3 h-7 w-32 rounded bg-surface-container-high animate-pulse" />
            ) : gastosErro ? (
              <p className="mt-2 text-sm text-on-surface-variant">Não foi possível carregar os gastos.</p>
            ) : (
              <>
                <p className="mt-1 text-2xl font-bold tabular-nums text-on-surface">{formatBRL(gastos?.total ?? 0)}</p>
                {user?.monthly_expense_budget_limit != null ? (() => {
                  const limite = Number(user.monthly_expense_budget_limit)
                  const total = gastos?.total ?? 0
                  const passou = total > limite
                  const percentual = limite > 0 ? Math.round((total / limite) * 100) : 100
                  return (
                    <div className="mt-3 space-y-1.5">
                      <div
                        className="h-2 rounded-full bg-surface-container overflow-hidden"
                        role="progressbar"
                        aria-label="Limite mensal de gastos usado"
                        aria-valuenow={Math.min(percentual, 100)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div className={`h-full rounded-full ${passou ? 'bg-error' : 'bg-primary'}`} style={{ width: `${Math.min(percentual, 100)}%` }} />
                      </div>
                      <p className={`text-xs ${passou ? 'text-error' : 'text-on-surface-variant'}`}>
                        {passou
                          ? `${formatBRL(total - limite)} acima do limite de ${formatBRL(limite)}`
                          : `${formatBRL(limite - total)} restantes de ${formatBRL(limite)}`}
                      </p>
                    </div>
                  )
                })() : (
                  <button onClick={() => navigate('/configuracoes')} className="mt-2 text-xs font-medium text-primary hover:text-primary/80">
                    Definir limite mensal →
                  </button>
                )}
              </>
            )}
          </div>
          <button onClick={() => navigate('/gastos')} className="min-h-[44px] shrink-0 text-xs font-medium text-primary hover:text-primary/80">
            Ver gastos →
          </button>
        </div>
      </section>

      <section className="glass-card rounded-2xl border border-outline-variant/50 p-5" aria-labelledby="checklist-hoje-titulo">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h3 id="checklist-hoje-titulo" className="text-base font-semibold text-on-surface">Checklist de hoje</h3>
            {checklist?.checklist && <p className="text-xs text-on-surface-variant">{checklist.checklist.name}</p>}
          </div>
          <button onClick={() => navigate('/checklists/lista')} className="min-h-[44px] text-xs font-medium text-primary hover:text-primary/80">
            Ver checklist →
          </button>
        </div>
        {loading ? (
          <div className="space-y-3"><SkeletonRow /><SkeletonRow /></div>
        ) : !checklist?.checklist ? (
          <div className="text-center py-3">
            <p className="text-sm text-on-surface-variant mb-3">Ainda não há checklist cadastrado.</p>
            <button onClick={() => navigate('/checklists/lista')} className="btn-primary mx-auto min-h-[44px]">Criar checklist</button>
          </div>
        ) : !checklist.today ? (
          <div className="text-center py-2">
            <p className="text-sm text-on-surface-variant mb-3">O checklist ainda não foi enviado hoje.</p>
            <button onClick={enviarChecklist} disabled={enviandoChecklist} className="btn-primary mx-auto min-h-[44px] disabled:opacity-50">
              {enviandoChecklist ? 'Enviando…' : 'Enviar checklist para o WhatsApp'}
            </button>
          </div>
        ) : (
          <>
            {checklist.today.status === 'pending' && (
              <p className="mb-3 text-xs text-on-surface-variant">Aguardando o envio da enquete para liberar as marcações.</p>
            )}
            <div className="flex items-center gap-3 mb-3">
              <div className="h-2 flex-1 rounded-full bg-surface-container overflow-hidden" role="progressbar" aria-label="Progresso do checklist de hoje" aria-valuenow={checklist.today.completion_pct} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(checklist.today.completion_pct, 100)}%` }} />
              </div>
              <span className="text-sm font-semibold tabular-nums text-on-surface">{checklist.today.completed_count}/{checklist.today.total_count}</span>
            </div>
            <div className="divide-y divide-outline-variant/30">
              {checklist.checklist.items.map((item) => {
                const marcado = checklist.today!.selected_options.includes(item.text)
                const ocupado = marcandoItem === item.text
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => marcarItem(item.text)}
                    disabled={marcado || !!marcandoItem || checklist.today!.status === 'pending'}
                    aria-pressed={marcado}
                    className="w-full min-h-[48px] flex items-center gap-3 py-2 text-left disabled:cursor-default"
                  >
                    <span className={`material-symbols-outlined text-xl ${marcado ? 'text-tertiary' : 'text-on-surface-variant/60'}`} style={marcado ? { fontVariationSettings: "'FILL' 1" } : undefined} aria-hidden="true">
                      {marcado ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                    <span className={`flex-1 text-sm ${marcado ? 'text-on-surface' : 'text-on-surface-variant'}`}>{item.text}</span>
                    {!marcado && <span className="text-xs text-primary">{ocupado ? 'Marcando…' : 'Marcar'}</span>}
                    {marcado && <span className="sr-only">Marcado hoje</span>}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </section>

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
