'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { DailyUser, DailyData } from '@/lib/types'
import LoadingSpinner from './LoadingSpinner'
import ErrorMessage from './ErrorMessage'
import KPICard from './KPICard'
import ActivityTable from './ActivityTable'
import { PieChart, Layers, CheckCircle2, Phone, Calendar, UserPlus, Plus, TrendingUp } from 'lucide-react'
import Link from 'next/link'

interface DashboardContentProps {
  userId?: string
}

export default function DashboardContent({ userId }: DashboardContentProps) {
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<DailyUser | null>(null)
  const [activities, setActivities] = useState<DailyData[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      if (!userId) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        // Buscar usuário
        const { data: userData, error: userError } = await supabase
          .from('daily_user')
          .select('*')
          .eq('id', userId)
          .single()

        if (userError || !userData) {
          throw userError || new Error('Usuário não encontrado')
        }

        // Buscar atividades
        const { data: activitiesData, error: activitiesError } = await supabase
          .from('daily_data')
          .select('*')
          .eq('id_user', userId)
          .order('activity_date', { ascending: false })

        if (activitiesError) {
          throw activitiesError
        }

        setUser(userData as DailyUser)
        setActivities((activitiesData as DailyData[]) || [])
      } catch (err: any) {
        console.error(err)
        setError(err.message || 'Erro ao carregar dados')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [userId])

  if (loading) {
    return <LoadingSpinner message="Carregando dados do usuário..." />
  }

  if (!userId) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-slate-100">
        <div className="bg-indigo-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <UserPlus className="text-indigo-600 w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Nenhum usuário selecionado</h2>
        <p className="text-slate-500 mb-6">
          Para visualizar um dashboard, você precisa criar um usuário primeiro ou acessar um usuário existente através do ID.
        </p>
        <Link
          href="/create"
          className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Criar Novo Usuário
        </Link>
      </div>
    )
  }

  if (error || !user) {
    return (
      <ErrorMessage
        title="Usuário não encontrado"
        message="Verifique se o ID na URL está correto (ex: ?id=1)."
        showCreateButton
      />
    )
  }

  // Calcular estatísticas
  const total = activities.length
  const completed = activities.filter(a => a.check_status).length
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0

  // Determinar cor da barra de progresso
  let progressColor: 'red' | 'yellow' | 'green' | 'blue' = 'blue'
  if (rate < 40) progressColor = 'red'
  else if (rate < 80) progressColor = 'yellow'
  else progressColor = 'green'

  const formattedDate = new Date(user.created_at).toLocaleDateString('pt-BR')

  return (
    <div className="fade-in space-y-8">
      {/* Cabeçalho do usuário */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-slate-900">{user.title || 'Sem Título'}</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              Ativo
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <Phone className="w-4 h-4" />
              <span>{user.phone || 'N/A'}</span>
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Desde: {formattedDate}
            </span>
          </div>
        </div>
        {user.option && (
          <div className="bg-slate-50 px-4 py-2 rounded-lg text-xs text-slate-600 border border-slate-200">
            <p className="font-semibold mb-1">Configurações (JSON)</p>
            <code className="block whitespace-pre-wrap">
              {JSON.stringify(user.option, null, 2).replace(/[{}"]/g, '')}
            </code>
          </div>
        )}
      </div>

      {/* Cards de KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KPICard
          title="Taxa de Conclusão"
          value={`${rate}%`}
          icon={PieChart}
          iconBgColor="bg-blue-50"
          iconColor="text-blue-600"
          progressBar={{ percentage: rate, color: progressColor }}
        />
        <KPICard
          title="Total de Atividades"
          value={total}
          icon={Layers}
          iconBgColor="bg-indigo-50"
          iconColor="text-indigo-600"
          subtitle="Registros totais no banco"
        />
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500">Dias Concluídos</p>
              <h3 className="text-3xl font-bold text-slate-900 mt-2">{completed}</h3>
            </div>
            <div className="p-2 bg-green-50 rounded-lg text-green-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>
          <p className="text-sm text-green-600 mt-4 font-medium flex items-center gap-1">
            <TrendingUp className="w-4 h-4" />
            Performance positiva
          </p>
        </div>
      </div>

      {/* Tabela de atividades */}
      <ActivityTable activities={activities} />
    </div>
  )
}
