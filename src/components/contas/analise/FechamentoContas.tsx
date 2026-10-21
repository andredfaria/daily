import React, { useEffect, useState } from 'react'
import { analyticsApi } from '../../../api/analytics'
import type { FechamentoContasResponse, ItemFechamentoContas } from '../../../types'
import { categoryColor } from '../../../utils/categoryColors'
import { infoCategoria } from '../../../utils/categoriasGasto'
import { useCategorias } from '../../../hooks/useCategorias'
import { formatBRL, formatDate } from '../../../utils/format'
import { rotuloPaga } from '../../../utils/pagamento'
import { mesLocal, somarMeses } from '../../../utils/historicoContas'

const SELO: Record<ItemFechamentoContas['situacao'], string> = {
  paga: 'bg-tertiary/15 text-tertiary',
  atrasada: 'bg-error/15 text-error',
  a_vencer: 'bg-outline-variant/30 text-on-surface-variant',
}

const rotuloSituacao = (item: ItemFechamentoContas): string =>
  item.situacao === 'paga' && item.paid_at
    ? rotuloPaga(item.paid_at)
    : item.situacao === 'atrasada'
      ? `Atrasada · ${formatDate(item.due_date, 'dd/MM')}`
      : `Vence ${formatDate(item.due_date, 'dd/MM')}`

/** Como foi o mês das contas: o que foi pago e o que ficou em aberto, por categoria. */
export const FechamentoContas: React.FC = () => {
  const categorias = useCategorias()
  const mesAtual = mesLocal()
  const [mes, setMes] = useState(mesAtual)
  const [dados, setDados] = useState<FechamentoContasResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    let ativo = true
    setLoading(true)
    setErro(false)
    analyticsApi
      .fechamentoContas(mes)
      .then((r) => { if (ativo) setDados(r) })
      .catch(() => { if (ativo) setErro(true) })
      .finally(() => { if (ativo) setLoading(false) })
    return () => { ativo = false }
  }, [mes])

  const nomeMes = formatDate(`${mes}-01`, "MMMM 'de' yyyy").replace(/^./, (c) => c.toUpperCase())
  const total = (dados?.pago ?? 0) + (dados?.aberto ?? 0)
  const pctPago = total > 0 ? Math.round(((dados?.pago ?? 0) / total) * 100) : 0

  return (
    <section className="glass-card rounded-2xl border border-outline-variant/50 p-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-on-surface">Fechamento do mês</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMes(somarMeses(mes, -1))}
            className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-on-surface-variant cursor-pointer"
            aria-label="Mês anterior"
          >
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <span className="text-sm font-semibold text-on-surface min-w-[140px] text-center">{nomeMes}</span>
          <button
            onClick={() => setMes(somarMeses(mes, 1))}
            disabled={mes >= mesAtual}
            className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-on-surface-variant disabled:opacity-30 cursor-pointer disabled:cursor-default"
            aria-label="Próximo mês"
          >
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-on-surface-variant">Carregando…</p>
      ) : erro || !dados ? (
        <p className="text-sm text-error">Não foi possível carregar o fechamento.</p>
      ) : dados.categorias.length === 0 ? (
        <p className="text-sm text-on-surface-variant">Nenhuma conta neste mês.</p>
      ) : (
        <>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm text-on-surface-variant">
                Pago <span className="text-lg font-bold text-on-surface">{formatBRL(dados.pago)}</span> de {formatBRL(total)}
              </span>
              <span className="text-xs font-semibold text-tertiary">{pctPago}%</span>
            </div>
            <div className="h-2 rounded-full bg-outline-variant/20 overflow-hidden">
              <div className="h-2 rounded-full bg-tertiary transition-all duration-700" style={{ width: `${pctPago}%` }} />
            </div>
            <p className="text-xs text-on-surface-variant">
              {dados.qtdPagas} {dados.qtdPagas === 1 ? 'paga' : 'pagas'}
              {dados.qtdAbertas > 0 && <> · {dados.qtdAbertas} em aberto ({formatBRL(dados.aberto)})</>}
              {dados.qtdAtrasadas > 0 && (
                <span className="text-error"> · {dados.qtdAtrasadas} {dados.qtdAtrasadas === 1 ? 'atrasada' : 'atrasadas'}</span>
              )}
            </p>
          </div>

          <ul className="space-y-4">
            {dados.categorias.map((c) => {
              const info = infoCategoria(c.category, categorias)
              const cor = categoryColor(c.category)
              const pct = c.total > 0 ? Math.round((c.pago / c.total) * 100) : 0
              return (
                <li key={c.category} className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 min-w-0 text-on-surface font-medium">
                      <span className="material-symbols-outlined text-lg flex-shrink-0" style={{ color: cor }}>{info.icone}</span>
                      <span className="truncate">{info.nome}</span>
                    </span>
                    <span className="text-xs text-on-surface-variant flex-shrink-0">
                      {formatBRL(c.pago)} de {formatBRL(c.total)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-outline-variant/20 overflow-hidden">
                    <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: cor }} />
                  </div>
                  <ul className="space-y-1.5 pl-7">
                    {c.itens.map((item) => (
                      <li key={item.id} className="flex items-center gap-2 text-sm">
                        <span className="flex-1 min-w-0 truncate text-on-surface">{item.bill_name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium flex-shrink-0 ${SELO[item.situacao]}`}>
                          {rotuloSituacao(item)}
                        </span>
                        <span className="w-24 text-right font-semibold text-on-surface flex-shrink-0">
                          {formatBRL(item.amount)}
                          {item.estimado && <span className="block text-[10px] font-normal text-on-surface-variant">estimado</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
