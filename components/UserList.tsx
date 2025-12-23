'use client'

import { useState, useEffect } from 'react'
import { Edit, Users, ExternalLink, Clock, CheckSquare, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { DailyUser } from '@/lib/types'
import LoadingSpinner from './LoadingSpinner'
import ErrorMessage from './ErrorMessage'
import Button from './ui/Button'
import Card from './ui/Card'

export default function UserList() {
  const [users, setUsers] = useState<DailyUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('daily_user')
        .select('*')
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      setUsers((data as DailyUser[]) || [])
    } catch (err: any) {
      console.error('Erro ao carregar usuários:', err)
      setError(err.message || 'Erro ao carregar lista de usuários')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingSpinner message="Carregando usuários..." />
  }

  if (error) {
    return <ErrorMessage message={error} />
  }

  if (users.length === 0) {
    return (
      <Card className="p-12 text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="bg-slate-100 p-4 rounded-full">
            <Users className="w-8 h-8 text-slate-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Nenhum usuário encontrado</h3>
            <p className="text-sm text-slate-500 mb-4">Comece criando seu primeiro usuário</p>
            <Link href="/create">
              <Button size="sm" icon={UserPlus}>
                Criar Usuário
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <>
      <Card
        title="Usuários Cadastrados"
        headerActions={
          <>
            <p className="text-sm text-slate-500 mr-4">{users.length} usuário{users.length !== 1 ? 's' : ''} encontrado{users.length !== 1 ? 's' : ''}</p>
            <Link href="/create">
              <Button size="sm" icon={UserPlus}>
                Novo Usuário
              </Button>
            </Link>
          </>
        }
        className="overflow-hidden"
        noPadding
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Título
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Telefone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Hora de Envio
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Checklist
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Data de Criação
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {users.map((user) => {
                const formattedDate = new Date(user.created_at).toLocaleDateString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })

                // Formatar hora de envio (time_to_send é a hora cheia, ex: 23 = 23h)
                const formatSendTime = (hour: number | null): string => {
                  if (hour === null || hour === undefined) return '-'
                  return `${String(hour).padStart(2, '0')}h`
                }

                // Formatar telefone (remover @c.us para exibição)
                const formatPhone = (phone: string | null): string => {
                  if (!phone) return ''
                  return phone.replace('@c.us', '')
                }

                // Parsear e formatar checklist (option vem como string JSON)
                const parseOptions = (option: string | null): string[] => {
                  if (!option) return []
                  try {
                    const parsed = JSON.parse(option)
                    return Array.isArray(parsed) ? parsed : []
                  } catch {
                    return []
                  }
                }

                const checklistItems = parseOptions(user.option as unknown as string)
                const checklistDisplay = checklistItems.length > 0
                  ? `${checklistItems.length} item${checklistItems.length !== 1 ? 's' : ''}`
                  : '-'

                return (
                  <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      #{user.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                      {user.name || <span className="text-slate-400">Não informado</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                      {user.title || <span className="text-slate-400">Sem título</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                      {user.phone ? formatPhone(user.phone) : <span className="text-slate-400">Não informado</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                      {user.time_to_send !== null && user.time_to_send !== undefined ? (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-4 h-4 text-slate-400" />
                          {formatSendTime(user.time_to_send)}
                        </span>
                      ) : (
                        <span className="text-slate-400">Não definido</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      {checklistItems.length > 0 ? (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 text-slate-500 text-xs font-medium">
                            <CheckSquare className="w-3 h-3" />
                            {checklistDisplay}
                          </span>
                          <ul className="list-none space-y-0.5 max-h-24 overflow-y-auto">
                            {checklistItems.map((item, idx) => (
                              <li key={idx} className="text-xs text-slate-600 pl-4 truncate max-w-48" title={item}>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <span className="text-slate-400">Sem itens</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {formattedDate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/?id=${user.id}`}>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={ExternalLink}
                            className="text-green-600 hover:bg-green-50 border-0"
                          >
                            Ver Dashboard
                          </Button>
                        </Link>
                        <Link href={`/edit?id=${user.id}`}>
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={Edit}
                            className="text-indigo-600 hover:bg-indigo-50 border-0"
                          >
                            Editar
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
