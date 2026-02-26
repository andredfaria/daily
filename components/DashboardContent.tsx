'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { getWhatsAppProfile, WAHAProfile } from '@/lib/waha'
import { DailyUser, DailyData } from '@/lib/types'
import ActivityTable from './ActivityTable'
import Card from './ui/Card'
import Skeleton from './ui/Skeleton'
import TrialBanner from './TrialBanner'
import { PieChart, Layers, CheckCircle2, Phone, Calendar, UserPlus, TrendingUp, AlertCircle } from 'lucide-react'

interface DashboardContentProps {
  initialData?: {
    user: DailyUser
    activities: DailyData[]
  } | null
}

export default function DashboardContent({ initialData }: DashboardContentProps) {
  // Usar dados pré-carregados como estado inicial
  const [user] = useState<DailyUser | null>(initialData?.user || null)
  const [activities] = useState<DailyData[]>(initialData?.activities || [])
  const [loading] = useState(!initialData)
  const [waProfile, setWaProfile] = useState<WAHAProfile | null>(null)


  // Buscar perfil WhatsApp em paralelo (não bloqueia renderização)
  useEffect(() => {
    const fetchWhatsAppProfile = async () => {
      if (!user?.phone) return

      try {
        const profile = await getWhatsAppProfile(user.phone)
        if (profile) {
          setWaProfile(profile)
        }
      } catch (error) {
        console.error('Erro ao buscar perfil do WhatsApp:', error)
      }
    }

    fetchWhatsAppProfile()
  }, [user?.phone])

  // Calcular estatísticas a partir das atividades
  const stats = {
    total: activities.length,
    completed: activities.filter(a => a.check_status).length,
    completionRate:
      activities.length > 0
        ? Math.round((activities.filter(a => a.check_status).length / activities.length) * 100)
        : 0,
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <div className="flex items-center gap-4">
            <Skeleton variant="circular" width={64} height={64} />
            <div className="flex-1 space-y-2">
              <Skeleton variant="text" width="40%" height={24} />
              <Skeleton variant="text" width="60%" height={16} />
            </div>
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <Skeleton variant="rectangular" height={120} />
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // Se não carregou usuário e não está carregando, mostra erro ou empty state
  if (!user) {
    // Se não achou usuário (não logado?)
    // O middleware deve tratar redirecionamento, mas por segurança:
    return (
      <Card className="text-center py-20 bg-slate-900/50 border-slate-800">
        <div className="bg-slate-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <UserPlus className="text-emerald-500 w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Sessão não encontrada</h2>
        <p className="text-slate-400 mb-6">
          Por favor, faça login novamente para acessar seus dados.
        </p>
        <button
          onClick={() => {
            if (typeof window !== 'undefined') {
              window.location.reload()
            }
          }}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
        >
          Recarregar Página
        </button>
      </Card>
    )
  }

  // Usar estatísticas calculadas
  const rate = stats.completionRate

  // Determinar cor da barra de progresso
  let progressColor: 'red' | 'yellow' | 'green' | 'blue' = 'blue'
  if (rate < 40) progressColor = 'red'
  else if (rate < 80) progressColor = 'yellow'
  else progressColor = 'green'

  // Parsear option que pode vir como string JSON ou array
  const parseOptions = (option: unknown): string[] => {
    if (!option) return []
    if (typeof option === 'string') {
      try {
        const parsed = JSON.parse(option)
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    }
    if (typeof option === 'object' && option !== null && 'checklist' in option && Array.isArray((option as { checklist: unknown }).checklist)) {
      return (option as { checklist: string[] }).checklist
    }
    if (Array.isArray(option)) {
      return option
    }
    return []
  }

  const pollOptions = parseOptions(user.option)

  // Verificar Status da Assinatura
  const daysInTrial = user.trial_ends_at
    ? Math.ceil((new Date(user.trial_ends_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : 0

  const isTrial = user.subscription_status === 'trial'
  const isSubscriptionActive = user.subscription_status === 'active' || (isTrial && daysInTrial > 0) || user.is_admin

  if (!isSubscriptionActive) {
    return (
      <Card className="text-center py-20 max-w-2xl mx-auto mt-10 border-red-500/20 bg-red-500/5">
        <div className="bg-red-500/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="text-red-500 w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-4">Sua assinatura expirou</h2>
        <p className="text-lg text-slate-400 mb-8 max-w-md mx-auto">
          O período de teste gratuito encerrou. Para continuar automatizando seus Daily&apos;s no WhatsApp, escolha um plano.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-8 rounded-lg shadow-lg hover:shadow-emerald-500/20 transition-all">
            Assinar Agora
          </button>
          <button className="bg-transparent border border-slate-700 text-slate-300 font-semibold py-3 px-8 rounded-lg hover:bg-slate-800 transition-all">
            Falar com Suporte
          </button>
        </div>
      </Card>
    )
  }

  return (
    <div className="fade-in space-y-6 pt-8">
      {/* Banner de Trial */}
      {isTrial && !user.is_admin && <TrialBanner />}

      {/* Layout Principal: Grid com 2 colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Esquerda: INFO + 4 Cards */}
        <div className="lg:col-span-2 space-y-6">
          {/* INFO - Cabeçalho do usuário */}
          <Card className="bg-gradient-to-r from-slate-900/80 via-slate-900/90 to-slate-800/80 border-l-4 border-l-emerald-500 backdrop-blur-sm hover:border-emerald-500/50 transition-all duration-300">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-start gap-4">
                {/* Avatar do WhatsApp */}
                {waProfile?.profilePicUrl && (
                  <div className="relative w-16 h-16">
                    <Image
                      src={waProfile.profilePicUrl}
                      alt="WhatsApp Profile"
                      width={64}
                      height={64}
                      className="rounded-full border-4 border-slate-800 shadow-md object-cover"
                      unoptimized
                    />
                    <div className="absolute bottom-0 right-0 w-5 h-5 bg-emerald-500 border-2 border-slate-800 rounded-full flex items-center justify-center">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-white">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-2xl font-bold text-white">{user.name}</h1>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Ativo
                    </span>
                  </div>
                  {/* Pushname do WhatsApp */}
                  {waProfile?.pushname && (
                    <div className="mb-1">
                      <span className="text-sm font-medium text-slate-300 block">
                        {waProfile.pushname}
                        <span className="text-xs font-normal text-slate-500 ml-2">(Nome no WhatsApp)</span>
                      </span>
                    </div>
                  )}

                  {/* Status/About do WhatsApp */}
                  {waProfile?.about && (
                    <div className="mb-2 text-sm text-slate-400 italic flex items-center gap-1">
                      <span>💬</span>
                      <span>&quot;{waProfile.about}&quot;</span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
                    <span className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700">
                      <Phone className="w-4 h-4 text-emerald-500" />
                      <span className="font-medium">{user.phone || 'N/A'}</span>
                    </span>
                  </div>

                </div>
              </div>
            </div>          </Card>

          {/* Grid 2x2 de Cards de KPI */}
          <div className="grid grid-cols-2 gap-4">
            {/* Card 1 - Taxa de Conclusão */}
            <Card className="bg-slate-900/60 backdrop-blur-sm border-slate-800/70 hover:border-emerald-500/40 hover:bg-slate-900/70 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/5">
              <div className="flex justify-between items-start mb-3">
                <div className="p-2.5 bg-blue-500/10 rounded-xl">
                  <PieChart className="w-5 h-5 text-blue-400" />
                </div>
                <span className="text-xs font-medium text-blue-400 bg-blue-500/10 px-2 py-1 rounded-full border border-blue-500/20">
                  KPI
                </span>
              </div>
              <p className="text-sm font-medium text-slate-400 mb-1">Taxa de Conclusão</p>
              <h3 className="text-3xl font-bold text-white">{rate}%</h3>
              <div className="mt-3 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${progressColor === 'red' ? 'bg-red-500' :
                    progressColor === 'yellow' ? 'bg-yellow-500' :
                      'bg-emerald-500'
                    }`}
                  style={{ width: `${rate}%` }}
                />
              </div>
            </Card>

            {/* Card 2 - Total de Atividades */}
            <Card className="bg-slate-900/60 backdrop-blur-sm border-slate-800/70 hover:border-emerald-500/40 hover:bg-slate-900/70 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/5">
              <div className="flex justify-between items-start mb-3">
                <div className="p-2.5 bg-emerald-500/10 rounded-xl">
                  <Layers className="w-5 h-5 text-emerald-500" />
                </div>
                <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
                  Total
                </span>
              </div>
              <p className="text-sm font-medium text-slate-400 mb-1">Total de Atividades</p>
              <h3 className="text-3xl font-bold text-white">{stats.total}</h3>
              <p className="text-xs text-slate-500 mt-2">Registros no banco</p>
            </Card>

            {/* Card 3 - Dias Concluídos */}
            <Card className="bg-slate-900/60 backdrop-blur-sm border-slate-800/70 hover:border-emerald-500/40 hover:bg-slate-900/70 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/5">
              <div className="flex justify-between items-start mb-3">
                <div className="p-2.5 bg-green-500/10 rounded-xl">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                </div>
                <span className="text-xs font-medium text-green-400 bg-green-500/10 px-2 py-1 rounded-full border border-green-500/20">
                  Sucesso
                </span>
              </div>
              <p className="text-sm font-medium text-slate-400 mb-1">Dias Concluídos</p>
              <h3 className="text-3xl font-bold text-white">{stats.completed}</h3>
              <p className="text-xs text-green-500 mt-2 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Performance positiva
              </p>
            </Card>

            {/* Card 4 - Próximo Envio */}
            <Card className="bg-slate-900/60 backdrop-blur-sm border-slate-800/70 hover:border-emerald-500/40 hover:bg-slate-900/70 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/5">
              <div className="flex justify-between items-start mb-3">
                <div className="p-2.5 bg-purple-500/10 rounded-xl">
                  <Calendar className="w-5 h-5 text-purple-400" />
                </div>
                <span className="text-xs font-medium text-purple-400 bg-purple-500/10 px-2 py-1 rounded-full border border-purple-500/20">
                  Agendado
                </span>
              </div>
              <p className="text-sm font-medium text-slate-400 mb-1">Próximo Envio</p>
              <h3 className="text-3xl font-bold text-white">
                {user.time_to_send !== null && user.time_to_send !== undefined
                  ? `${String(user.time_to_send).padStart(2, '0')}:00`
                  : 'N/A'}
              </h3>
              <p className="text-xs text-purple-400 mt-2 flex items-center gap-1">
                🕐 Horário programado
              </p>
            </Card>
          </div>
        </div>

        {/* Coluna Direita: ENQUETE */}
        <div className="lg:col-span-1">
          <Card className="overflow-hidden p-0 h-full bg-gradient-to-b from-slate-900 to-slate-950 border-0 shadow-lg">
            {/* Header da Enquete */}
            <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-emerald-600 to-teal-600">
              <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{user.title || 'Enquete'}</h3>
                <p className="text-sm text-white/80">Opções diárias</p>
              </div>
            </div>

            {/* Poll Content */}
            <div className="p-5">
              {/* Poll Title */}
              {user.title && (
                <div className="mb-5">
                  <p className="text-white text-lg font-semibold">{user.title}</p>
                  <p className="text-slate-400 text-sm flex items-center gap-2 mt-1">
                    <span>📊</span> Selecione uma ou mais opções
                  </p>
                </div>
              )}

              {/* Poll Options */}
              {pollOptions.length > 0 ? (
                <div className="space-y-3">
                  {pollOptions.map((option, index) => (
                    <div
                      key={index}
                      className="bg-slate-700/50 border border-slate-600/50 rounded-xl px-4 py-3 hover:bg-slate-700/70 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full border-2 border-green-400/50 flex-shrink-0 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-green-400/30" />
                        </div>
                        <span className="text-white text-sm font-medium">{option}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-slate-400 text-sm">Nenhuma opção configurada</p>
                </div>
              )}

              {/* Poll Footer */}
              <div className="flex items-center justify-between pt-5 mt-5 border-t border-slate-700/50">
                <span className="text-xs text-slate-500">
                  {pollOptions.length} opç{pollOptions.length === 1 ? 'ão' : 'ões'}
                </span>
                {user.time_to_send !== null && user.time_to_send !== undefined && (
                  <span className="text-xs text-green-400 font-medium flex items-center gap-1">
                    🕐 {String(user.time_to_send).padStart(2, '0')}:00
                  </span>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* EVOLUÇÃO DAS OPÇÕES - Heatmap/Grid */}
      <Card className="overflow-hidden bg-slate-900/60 backdrop-blur-sm border-slate-800/70">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-emerald-500/10 rounded-xl">
            <TrendingUp className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Evolução das Atividades</h3>
            <p className="text-sm text-slate-400">Acompanhamento diário dos últimos 14 dias</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[800px] pb-4">
            {(() => {
              // Get all unique options from activities
              const uniqueOptions = Array.from(new Set(activities.map(a => a.option).filter(Boolean)))

              if (uniqueOptions.length === 0) {
                return (
                  <div className="text-center py-8 text-slate-400 italic">
                    Nenhuma atividade registrada para este usuário.
                  </div>
                )
              }

              return (
                <>
                  {/* Header Dates */}
                  <div className="grid grid-cols-[200px_repeat(14,1fr)] gap-2 mb-2">
                    <div className="font-semibold text-slate-400 text-sm">Opção</div>
                    {Array.from({ length: 14 }).map((_, i) => {
                      const d = new Date()
                      d.setDate(d.getDate() - (13 - i))
                      return (
                        <div key={i} className="text-center">
                          <span className="text-xs font-medium text-slate-500 block mb-1">
                            {d.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3)}
                          </span>
                          <span className="text-xs font-bold text-slate-400">
                            {d.getDate()}/{d.getMonth() + 1}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Rows for each unique option */}
                  {uniqueOptions.map((optionName, idx) => (
                    <div key={idx} className="grid grid-cols-[200px_repeat(14,1fr)] gap-2 mb-2 items-center hover:bg-slate-800/30 rounded-lg p-1 transition-all duration-200">
                      <div className="text-sm font-medium text-slate-300 truncate pr-4" title={optionName ?? undefined}>
                        {optionName}
                      </div>
                      {Array.from({ length: 14 }).map((_, i) => {
                        const d = new Date()
                        d.setDate(d.getDate() - (13 - i))
                        const dateStr = d.toISOString().split('T')[0]

                        // Find activity for this option on this day
                        const dayActivity = activities.find(a => {
                          const rawActDate = a.activity_date
                          let actDateStr = ''

                          if (rawActDate instanceof Date) {
                            actDateStr = rawActDate.toISOString().split('T')[0]
                          } else if (typeof rawActDate === 'string') {
                            actDateStr = rawActDate.split('T')[0]
                          }

                          return actDateStr === dateStr && a.option === optionName
                        })

                        const isCompleted = dayActivity?.check_status === true
                        const exists = !!dayActivity

                        return (
                          <div key={i} className="flex justify-center">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 ${isCompleted
                                ? 'bg-emerald-500 shadow-md shadow-emerald-500/20 scale-100'
                                : exists
                                  ? 'bg-red-500/80 shadow-sm shadow-red-500/20 scale-100'
                                  : 'bg-slate-800 scale-75 opacity-50'
                                }`}
                              title={`${optionName} em ${d.toLocaleDateString('pt-BR')}: ${isCompleted ? 'Concluído ✓' : exists ? 'Não concluído ✗' : 'Sem registro'
                                }`}
                            >
                              {isCompleted && <CheckCircle2 className="w-5 h-5 text-white" />}
                              {exists && !isCompleted && (
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </>
              )
            })()}
          </div>
        </div>
      </Card>
      <Card className="overflow-hidden bg-slate-900/60 backdrop-blur-sm border-slate-800/70">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-slate-800 rounded-xl">
            <Layers className="w-5 h-5 text-slate-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Histórico de Atividades</h3>
            <p className="text-sm text-slate-400">Registro completo de todas as atividades</p>
          </div>
        </div>
        <ActivityTable activities={activities} />
      </Card>
    </div >
  )
}
