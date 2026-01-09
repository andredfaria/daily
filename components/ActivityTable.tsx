import { Check, X, Inbox } from 'lucide-react'
import { DailyData } from '@/lib/types'

interface ActivityTableProps {
  activities: DailyData[]
}

export default function ActivityTable({ activities }: ActivityTableProps) {
  if (activities.length === 0) {
    return (
      <div className="bg-slate-900/40 rounded-2xl shadow-sm border border-slate-800/50 overflow-hidden backdrop-blur-sm">
        <div className="px-6 py-4 border-b border-slate-800/50 flex justify-between items-center bg-slate-900/30">
          <h3 className="font-semibold text-white">Histórico de Atividades</h3>
        </div>
        <div className="py-12 text-center">
          <div className="bg-slate-800/50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
            <Inbox className="text-slate-400 w-6 h-6" />
          </div>
          <p className="text-slate-400">Nenhuma atividade registrada ainda.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-900/40 rounded-2xl shadow-sm border border-slate-800/50 overflow-hidden backdrop-blur-sm">
      <div className="px-6 py-4 border-b border-slate-800/50 flex justify-between items-center bg-slate-900/30">
        <h3 className="font-semibold text-white">Histórico de Atividades</h3>
        <button className="text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors">Ver tudo</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-800/50 text-xs uppercase text-slate-400 font-semibold">
            <tr>
              <th className="px-6 py-3">Data</th>
              <th className="px-6 py-3">Opção</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3 text-right">Registro ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {activities.map((item) => {
              const date = new Date(item.activity_date + 'T00:00:00')
              const formattedDate = new Intl.DateTimeFormat('pt-BR', {
                day: 'numeric',
                month: 'long',
                weekday: 'short'
              }).format(date)

              return (
                <tr key={item.id} className="hover:bg-slate-800/30 transition-all duration-200">
                  <td className="px-6 py-4 font-medium text-slate-200">{formattedDate}</td>
                  <td className="px-6 py-4 text-slate-300">{item.option || '-'}</td>
                  <td className="px-6 py-4">
                    {item.check_status ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <Check className="w-3 h-3" />
                        Concluído
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                        <X className="w-3 h-3" />
                        Pendente
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-xs text-slate-500">#{item.id}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
