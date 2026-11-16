import React, { useState } from 'react'
import { formatBRL, formatDate } from '../../utils/format'
import { formatNumericInput, parseNumericInput } from '../../utils/numberInput'
import { NOMES_DIA, duracaoBloco, type FimDeSemana, type ResumoFinsDeSemana } from '../../utils/gastosFimDeSemana'
import type { DadosMetaSemanal } from '../../api/expenseGoals'
import NumberField from '../ui/NumberField'
import Select from '../ui/Select'

interface Props {
  resumo: ResumoFinsDeSemana
  meta: number | null
  inicioDow: number
  fimDow: number
  onSalvar: (dados: DadosMetaSemanal) => Promise<boolean>
}

const NOMES_DIA_LONGOS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

// Classes fixas para o Tailwind enxergar; acima de 4 dias, quebra em duas linhas no celular.
const COLUNAS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-3 sm:grid-cols-5',
  6: 'grid-cols-3 sm:grid-cols-6',
  7: 'grid-cols-4 sm:grid-cols-7',
}

const periodo = (f: FimDeSemana) =>
  f.inicio === f.fim ? formatDate(f.inicio, 'dd/MM') : `${formatDate(f.inicio, 'dd/MM')} a ${formatDate(f.fim, 'dd/MM')}`

const diaDaSemana = (dia: string) => new Date(`${dia}T12:00:00`).getDay()

const descricaoDias = (inicio: number, fim: number) =>
  inicio === fim ? NOMES_DIA[inicio] : `${NOMES_DIA[inicio]} a ${NOMES_DIA[fim]}`

const Barra: React.FC<{ total: number; meta: number; rotulo: string; fina?: boolean }> = ({ total, meta, rotulo, fina }) => {
  const estourou = total > meta
  const pct = meta > 0 ? Math.min(100, Math.round((total / meta) * 100)) : 100
  return (
    <div
      className={`${fina ? 'h-1.5' : 'h-2'} rounded-full bg-surface-container overflow-hidden`}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={rotulo}
    >
      <div className={`h-full rounded-full ${estourou ? 'bg-error' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

const EdicaoMetaSemanal: React.FC<{
  meta: number | null
  inicioDow: number
  fimDow: number
  onSalvar: Props['onSalvar']
  onCancelar: () => void
}> = ({ meta, inicioDow, fimDow, onSalvar, onCancelar }) => {
  const [inicio, setInicio] = useState(String(inicioDow))
  const [fim, setFim] = useState(String(fimDow))
  const [valor, setValor] = useState(meta !== null ? formatNumericInput(meta, 2, { padDecimals: true }) : '')
  const [salvando, setSalvando] = useState(false)
  const dias = duracaoBloco(Number(inicio), Number(fim))
  const opcoes = NOMES_DIA_LONGOS.map((nome, i) => ({ value: String(i), label: nome, icon: 'calendar_today' }))

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    setSalvando(true)
    // Valor vazio desliga a meta, mas os dias continuam valendo para o card.
    const ok = await onSalvar({
      weekend_expense_goal: parseNumericInput(valor),
      weekend_goal_start_dow: Number(inicio),
      weekend_goal_end_dow: Number(fim),
    })
    if (!ok) setSalvando(false)
  }

  return (
    <form onSubmit={salvar} onKeyDown={(e) => e.key === 'Escape' && onCancelar()} className="space-y-3" aria-label="Editar meta semanal">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="meta-semana-inicio">Começa</label>
          <Select id="meta-semana-inicio" value={inicio} onChange={setInicio} options={opcoes} />
        </div>
        <div>
          <label className="label" htmlFor="meta-semana-fim">Termina</label>
          <Select id="meta-semana-fim" value={fim} onChange={setFim} options={opcoes} />
        </div>
      </div>
      <NumberField label="Meta por semana" mode="currency" min={0} prefix="R$" placeholder="Ex.: 300,00" value={valor} onChange={setValor} />
      <p className="text-xs text-on-surface-variant">
        {dias === 1 ? '1 dia' : `${dias} dias`} por semana. Valor vazio desliga a meta.
      </p>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancelar} className="btn-ghost min-h-[44px]">Cancelar</button>
        <button type="submit" disabled={salvando} className="btn-primary min-h-[44px]">
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </form>
  )
}

/** Fim de semana mais recente em destaque, com o dia a dia; os demais do mês abaixo. */
const FinsDeSemanaGastos: React.FC<Props> = ({ resumo, meta, inicioDow, fimDow, onSalvar }) => {
  const [editando, setEditando] = useState(false)
  const [destaque, ...anteriores] = resumo.fins
  const maiorDia = destaque ? Math.max(...destaque.dias.map((d) => d.total), 0) : 0

  const salvar = async (dados: DadosMetaSemanal) => {
    const ok = await onSalvar(dados)
    if (ok) setEditando(false)
    return ok
  }

  return (
    <section className="glass-card rounded-2xl border border-outline-variant/50 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-on-surface">Fins de semana</h2>
          <p className="text-xs text-on-surface-variant">
            {descricaoDias(inicioDow, fimDow)}{meta !== null ? ` · meta de ${formatBRL(meta)}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {!editando && meta !== null && resumo.fechados > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-primary/15 text-primary text-xs font-semibold tabular-nums">
              {resumo.dentro} de {resumo.fechados} na meta
            </span>
          )}
          {!editando && (
            <button
              onClick={() => setEditando(true)}
              className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-primary cursor-pointer"
              aria-label="Editar dias e meta do fim de semana"
            >
              <span className="material-symbols-outlined text-base">tune</span>
            </button>
          )}
        </div>
      </div>

      {editando ? (
        <EdicaoMetaSemanal meta={meta} inicioDow={inicioDow} fimDow={fimDow} onSalvar={salvar} onCancelar={() => setEditando(false)} />
      ) : (
        <>
          {meta === null && (
            <button
              onClick={() => setEditando(true)}
              className="text-xs text-primary hover:text-primary/80 font-medium cursor-pointer"
            >
              Definir meta →
            </button>
          )}

          {!destaque ? (
            <p className="text-sm text-on-surface-variant">Nenhum fim de semana começou neste mês ainda.</p>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
                  {destaque.emAndamento ? 'Este fim de semana' : 'Último'} · {periodo(destaque)}
                </span>
                <span className={`text-lg font-semibold tabular-nums ${destaque.dentroDaMeta === false ? 'text-error' : 'text-on-surface'}`}>
                  {formatBRL(destaque.total)}
                </span>
              </div>
              {meta !== null && (
                <>
                  <Barra total={destaque.total} meta={meta} rotulo="Meta do fim de semana usada" />
                  <p className={`text-xs ${destaque.dentroDaMeta === false ? 'text-error' : 'text-on-surface-variant'}`}>
                    {destaque.dentroDaMeta === false
                      ? `${formatBRL(destaque.total - meta)} acima da meta`
                      : destaque.emAndamento
                        ? `${formatBRL(meta - destaque.total)} disponíveis até ${NOMES_DIA_LONGOS[fimDow].toLowerCase()}`
                        : `Fechou ${formatBRL(meta - destaque.total)} abaixo da meta`}
                  </p>
                </>
              )}
              <ul className={`grid gap-2 ${COLUNAS[destaque.dias.length]}`}>
                {destaque.dias.map((d) => (
                  <li
                    key={d.dia}
                    className={`rounded-xl px-2 py-2 text-center ${d.futuro ? 'border border-dashed border-outline-variant/60' : 'bg-surface-container/60'}`}
                  >
                    <span className="block text-[11px] text-on-surface-variant">{NOMES_DIA[diaDaSemana(d.dia)]} {formatDate(d.dia, 'dd')}</span>
                    <span className={`block text-xs font-semibold tabular-nums ${d.futuro ? 'text-on-surface-variant/60' : d.total > 0 && d.total === maiorDia ? 'text-primary' : 'text-on-surface'}`}>
                      {d.futuro ? '—' : formatBRL(d.total)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {anteriores.length > 0 && (
            <ul className="pt-3 border-t border-outline-variant/30 space-y-3">
              {anteriores.map((f) => (
                <li key={f.inicio} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-1.5 text-on-surface-variant">
                      {f.dentroDaMeta !== null && (
                        <span
                          className={`material-symbols-outlined text-base ${f.dentroDaMeta ? 'text-tertiary' : 'text-error'}`}
                          role="img"
                          aria-label={f.dentroDaMeta ? 'dentro da meta' : 'acima da meta'}
                        >
                          {f.dentroDaMeta ? 'check_circle' : 'error'}
                        </span>
                      )}
                      {periodo(f)}
                    </span>
                    <span className={`font-semibold tabular-nums ${f.dentroDaMeta === false ? 'text-error' : 'text-on-surface'}`}>
                      {formatBRL(f.total)}
                    </span>
                  </div>
                  {meta !== null && <Barra total={f.total} meta={meta} rotulo={`Meta usada de ${periodo(f)}`} fina />}
                </li>
              ))}
            </ul>
          )}

          {resumo.media !== null && (
            <p className="text-xs text-on-surface-variant">Média por fim de semana: {formatBRL(resumo.media)}</p>
          )}
        </>
      )}
    </section>
  )
}

export default FinsDeSemanaGastos
