import React, { useCallback, useEffect, useState } from 'react'
import { analyticsApi } from '../../api/analytics'
import type { FechamentoContasResponse, MesHistoricoContas } from '../../types'
import { StatCard } from '../../components/ui/StatCard'
import { SkeletonStatCard } from '../../components/ui/Skeleton'
import { categoryColor } from '../../utils/categoryColors'
import { infoCategoria } from '../../utils/categoriasGasto'
import { useCategorias } from '../../hooks/useCategorias'
import { formatBRL, formatDate } from '../../utils/format'
import { rotuloPaga } from '../../utils/pagamento'
import { mesLocal, separarContasDoMes, somarMeses, type ContaDoMes } from '../../utils/historicoContas'

// Os vencimentos existem até 12 meses à frente; dá para olhar o que vem.
const MESES_A_FRENTE = 11

const nomeDoMes = (mes: string, pattern = "MMMM 'de' yyyy") =>
  formatDate(`${mes}-01`, pattern).replace(/^./, (c) => c.toUpperCase())

const LinhaConta: React.FC<{ conta: ContaDoMes }> = ({ conta }) => {
  const categorias = useCategorias()
  const info = infoCategoria(conta.category, categorias)
  const detalhe = conta.situacao === 'paga'
    ? `${conta.paid_at ? rotuloPaga(conta.paid_at) : 'Paga'}${conta.source === 'whatsapp' ? ' · WhatsApp' : ''}`
    : conta.situacao === 'atrasada'
      ? `Venceu ${formatDate(conta.due_date, 'dd/MM')}`
      : `Vence ${formatDate(conta.due_date, 'dd/MM')}`
  return (
    <li className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-surface-container-high flex items-center justify-center flex-shrink-0">
        <span className="material-symbols-outlined text-lg" style={{ color: categoryColor(conta.category) }}>{info.icone}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-on-surface truncate">{conta.bill_name}</p>
        <p className={`text-xs ${conta.situacao === 'atrasada' ? 'text-error' : 'text-on-surface-variant'}`}>
          {info.nome} · {detalhe}
        </p>
      </div>
      <span className="text-sm font-bold text-on-surface text-right flex-shrink-0">
        {formatBRL(conta.amount)}
        {conta.estimado && <span className="block text-[10px] font-normal text-on-surface-variant">estimado</span>}
      </span>
    </li>
  )
}

const ContasHistorico: React.FC = () => {
  const mesAtual = mesLocal()
  const [mes, setMes] = useState(mesAtual)
  const [fechamento, setFechamento] = useState<FechamentoContasResponse | null>(null)
  const [historico, setHistorico] = useState<MesHistoricoContas[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(false)

  const carregarMes = useCallback(async (alvo: string) => {
    setLoading(true)
    setErro(false)
    try {
      setFechamento(await analyticsApi.fechamentoContas(alvo))
    } catch {
      setErro(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { carregarMes(mes) }, [mes, carregarMes])
  useEffect(() => {
    analyticsApi.historicoContas(12).then(setHistorico).catch(() => setHistorico([]))
  }, [])

  const { faltaPagar, pagas } = fechamento ? separarContasDoMes(fechamento) : { faltaPagar: [], pagas: [] }
  const maiorMes = Math.max(...historico.map((h) => h.pago + h.aberto), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-1">
        <button
          onClick={() => setMes(somarMeses(mes, -1))}
          className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-on-surface-variant cursor-pointer"
          aria-label="Mês anterior"
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <span className="text-sm font-semibold text-on-surface min-w-[160px] text-center">{nomeDoMes(mes)}</span>
        <button
          onClick={() => setMes(somarMeses(mes, 1))}
          disabled={mes >= somarMeses(mesAtual, MESES_A_FRENTE)}
          className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-on-surface-variant disabled:opacity-30 cursor-pointer disabled:cursor-default"
          aria-label="Próximo mês"
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>

      {erro ? (
        <div className="glass-card rounded-2xl border border-error/30 p-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-error">error</span>
          <p className="text-sm text-on-surface flex-1">Não foi possível carregar o mês.</p>
          <button onClick={() => carregarMes(mes)} className="btn-ghost text-xs min-h-[44px]">Tentar de novo</button>
        </div>
      ) : loading || !fechamento ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonStatCard key={i} />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard
              icon="task_alt" label="Pago" value={formatBRL(fechamento.pago)}
              sub={`${fechamento.qtdPagas} ${fechamento.qtdPagas === 1 ? 'conta' : 'contas'}`}
              iconColor="text-tertiary" iconBg="bg-tertiary/15"
            />
            <StatCard
              icon="pending" label="Falta pagar" value={formatBRL(fechamento.aberto)}
              sub={`${fechamento.qtdAbertas} ${fechamento.qtdAbertas === 1 ? 'conta' : 'contas'}`}
              iconColor="text-primary" iconBg="bg-primary/15"
            />
            <StatCard
              icon="warning" label="Atrasado" value={formatBRL(fechamento.atrasado)}
              sub={`${fechamento.qtdAtrasadas} ${fechamento.qtdAtrasadas === 1 ? 'conta' : 'contas'}`}
              iconColor={fechamento.qtdAtrasadas > 0 ? 'text-error' : 'text-on-surface-variant'}
              iconBg={fechamento.qtdAtrasadas > 0 ? 'bg-error/15' : 'bg-surface-container-high'}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="glass-card rounded-2xl border border-outline-variant/50 p-5">
              <h2 className="text-base font-semibold text-on-surface mb-4">Falta pagar</h2>
              {faltaPagar.length === 0 ? (
                <p className="text-sm text-on-surface-variant">
                  {pagas.length > 0 ? 'Tudo pago neste mês.' : 'Nenhuma conta neste mês.'}
                </p>
              ) : (
                <ul className="space-y-3">{faltaPagar.map((c) => <LinhaConta key={c.id} conta={c} />)}</ul>
              )}
            </section>

            <section className="glass-card rounded-2xl border border-outline-variant/50 p-5">
              <h2 className="text-base font-semibold text-on-surface mb-4">Pago</h2>
              {pagas.length === 0 ? (
                <p className="text-sm text-on-surface-variant">Nenhuma conta paga neste mês.</p>
              ) : (
                <ul className="space-y-3">{pagas.map((c) => <LinhaConta key={c.id} conta={c} />)}</ul>
              )}
            </section>
          </div>
        </>
      )}

      {historico.length > 0 && (
        <section className="glass-card rounded-2xl border border-outline-variant/50 p-5">
          <h2 className="text-base font-semibold text-on-surface mb-4">Mês a mês</h2>
          <ul className="space-y-1">
            {[...historico].reverse().map((h) => {
              const total = h.pago + h.aberto
              const escala = maiorMes > 0 ? (total / maiorMes) * 100 : 0
              const pctPago = total > 0 ? (h.pago / total) * 100 : 0
              return (
                <li key={h.mes}>
                  <button
                    onClick={() => setMes(h.mes)}
                    className={`w-full min-h-[44px] px-2 py-1.5 rounded-lg text-left space-y-1 cursor-pointer transition-colors ${
                      h.mes === mes ? 'bg-primary/10' : 'hover:bg-surface-container-high'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-on-surface font-medium">{nomeDoMes(h.mes, 'MMM/yy')}</span>
                      <span className="text-xs text-on-surface-variant">
                        {formatBRL(h.pago)} pago
                        {h.aberto > 0 && <span className="text-error"> · {formatBRL(h.aberto)} em aberto</span>}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-outline-variant/20 overflow-hidden" style={{ width: `${Math.max(escala, 2)}%` }}>
                      <div className="h-1.5 rounded-full bg-tertiary" style={{ width: `${pctPago}%` }} />
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

export default ContasHistorico
