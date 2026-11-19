import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getVisaoGeral } from '../../api/admin'
import { StatCard } from '../../components/ui/StatCard'
import { SeloStatus } from '../../components/admin/FeedAtividade'
import { rotuloAtividade, tempoRelativo } from '../../utils/atividade'
import type { VisaoGeralAdmin } from '../../types'

const AdminGeral: React.FC = () => {
  const navigate = useNavigate()
  const [dados, setDados] = useState<VisaoGeralAdmin | null>(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    getVisaoGeral(24).then(setDados).catch(() => setErro(true))
  }, [])

  if (erro) return <p className="text-sm text-error text-center py-8">Não foi possível carregar a visão geral.</p>
  if (!dados) return <p className="text-sm text-on-surface-variant text-center py-8">Carregando…</p>

  const totalFalhas = dados.falhasPorTipo.reduce((s, f) => s + f.total, 0)
  const destino = (kind: string) =>
    kind === 'msg_enviada'
      ? '/admin/mensagens?falhas=1'
      : kind === 'comando'
        ? '/admin/mensagens?tipo=comando&falhas=1'
        : '/admin/erros'

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon="warning" label="Falhas nas últimas 24h" value={totalFalhas} iconColor="text-error" iconBg="bg-error/10" />
        <StatCard
          icon="person"
          label="Ativos em 24h"
          value={dados.ativos.h24}
          sub={`${dados.ativos.d7} em 7d · ${dados.ativos.d30} em 30d`}
          iconColor="text-primary"
          iconBg="bg-primary/10"
        />
        <StatCard icon="send" label="Enviadas hoje" value={dados.enviadasHoje} iconColor="text-primary" iconBg="bg-primary/10" />
        <StatCard icon="calendar_month" label="Ativos em 7 dias" value={dados.ativos.d7} iconColor="text-primary" iconBg="bg-primary/10" />
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-on-surface">Falhas por tipo (24h)</h2>
        {dados.falhasPorTipo.length === 0 ? (
          <p className="text-sm text-on-surface-variant">Nenhuma falha nas últimas 24h.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {dados.falhasPorTipo.map((f) => (
              <button
                key={`${f.kind}:${f.ref ?? ''}`}
                onClick={() => navigate(destino(f.kind))}
                className="min-h-[44px] px-4 rounded-full bg-error/10 text-error text-sm font-medium"
              >
                {rotuloAtividade(f.kind, f.ref)} · {f.total}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-on-surface">Últimas falhas</h2>
        {dados.ultimasFalhas.length === 0 ? (
          <p className="text-sm text-on-surface-variant">Sem falhas recentes.</p>
        ) : (
          <ul className="space-y-2">
            {dados.ultimasFalhas.map((f) => (
              <li key={f.id} className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-on-surface-variant">{tempoRelativo(f.created_at)}</span>
                  <span className="text-sm text-on-surface">{f.user_name ?? '—'}</span>
                  <span className="text-sm font-medium text-on-surface">{rotuloAtividade(f.kind, f.ref)}</span>
                  <SeloStatus status={f.status} />
                </div>
                {(f.error || f.detail) && (
                  <p className="text-xs text-on-surface-variant mt-1 break-words line-clamp-2">{f.error ?? f.detail}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default AdminGeral
