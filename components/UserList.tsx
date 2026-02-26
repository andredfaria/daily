'use client'

import { Edit, Users, ExternalLink, Clock, CheckSquare, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { useUsers } from '@/lib/hooks'
import Alert from './ui/Alert'
import Skeleton from './ui/Skeleton'
import Button from './ui/Button'
import Card from './ui/Card'

export default function UserList() {
  const { canEdit } = useAuth()
  const { users, loading, error } = useUsers()

  if (loading) {
    return (
      <Card>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton variant="circular" width={48} height={48} />
              <div className="flex-1 space-y-2">
                <Skeleton variant="text" width="60%" height={20} />
                <Skeleton variant="text" width="40%" height={16} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    )
  }

  if (error) {
    return <Alert variant="error" className="max-w-2xl mx-auto mt-10">{error.message || 'Erro ao carregar lista de usuários'}</Alert>
  }

  if (users.length === 0) {
    return (
      <Card className="p-12 text-center bg-slate-900/50 border-slate-800">
        <div className="flex flex-col items-center gap-4">
          <div className="bg-slate-800 p-4 rounded-full">
            <Users className="w-8 h-8 text-slate-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">Nenhum usuário encontrado</h3>
            <p className="text-sm text-slate-400 mb-4">Comece criando seu primeiro usuário</p>
            <Link href="/create">
              <Button size="sm" icon={UserPlus} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20">
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
            <p className="text-sm text-slate-400 mr-4">{users.length} usuário{users.length !== 1 ? 's' : ''} encontrado{users.length !== 1 ? 's' : ''}</p>
            <Link href="/create">
              <Button size="sm" icon={UserPlus} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20">
                Novo Usuário
              </Button>
            </Link>
          </>
        }
        className="overflow-hidden bg-slate-900/50 border-slate-800 backdrop-blur-sm"
        noPadding
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-950/50 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Nome
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Título
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Telefone
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Hora de Envio
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Checklist
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Data de Criação
                </th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
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
                  <tr key={user.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                      #{user.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      {user.name || <span className="text-slate-600">Não informado</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      {user.title || <span className="text-slate-600">Sem título</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      {user.phone ? formatPhone(user.phone) : <span className="text-slate-600">Não informado</span>}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      {user.time_to_send !== null && user.time_to_send !== undefined ? (
                        <span className="inline-flex items-center gap-1 font-mono text-emerald-400">
                          <Clock className="w-4 h-4" />
                          {formatSendTime(user.time_to_send)}
                        </span>
                      ) : (
                        <span className="text-slate-600">Não definido</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">
                      {checklistItems.length > 0 ? (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-medium">
                            <CheckSquare className="w-3 h-3" />
                            {checklistDisplay}
                          </span>
                          <ul className="list-none space-y-0.5 max-h-24 overflow-y-auto">
                            {checklistItems.map((item, idx) => (
                              <li key={idx} className="text-xs text-slate-500 pl-4 truncate max-w-48" title={item}>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        <span className="text-slate-600">Sem itens</span>
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
                            className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 border-0 bg-transparent"
                          >
                            Ver Dashboard
                          </Button>
                        </Link>
                        {canEdit(user.id) && (
                          <Link href={`/edit?id=${user.id}`}>
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={Edit}
                              className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 border-0 bg-transparent"
                            >
                              Editar
                            </Button>
                          </Link>
                        )}
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
