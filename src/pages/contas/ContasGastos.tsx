import React, { useCallback, useEffect, useState } from 'react'
import { expensesApi } from '../../api/expenses'
import type { Expense } from '../../types'
import { formatBRL, formatDate } from '../../utils/format'
import { parseNumericInput } from '../../utils/numberInput'
import NumberField from '../../components/ui/NumberField'
import Modal from '../../components/ui/Modal'
import { SkeletonCard } from '../../components/ui/Skeleton'
import { useToast } from '../../context/ToastContext'

const hojeLocal = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const somarMeses = (mes: string, n: number): string => {
  const [a, m] = mes.split('-').map(Number)
  const d = new Date(a, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Agrupa por dia mantendo a ordem da API (mais recente primeiro). */
function porDia(gastos: Expense[]): Array<{ dia: string; itens: Expense[] }> {
  const grupos: Array<{ dia: string; itens: Expense[] }> = []
  for (const g of gastos) {
    const ultimo = grupos[grupos.length - 1]
    if (ultimo?.dia === g.spent_on) ultimo.itens.push(g)
    else grupos.push({ dia: g.spent_on, itens: [g] })
  }
  return grupos
}

const ContasGastos: React.FC = () => {
  const mesAtual = hojeLocal().slice(0, 7)
  const [mes, setMes] = useState(mesAtual)
  const [gastos, setGastos] = useState<Expense[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [dia, setDia] = useState(hojeLocal())
  const [salvando, setSalvando] = useState(false)

  const [apagar, setApagar] = useState<Expense | null>(null)
  const [apagando, setApagando] = useState(false)
  const { success, error: showError } = useToast()

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const data = await expensesApi.list(mes)
      setGastos(data.gastos)
      setTotal(data.total)
    } catch {
      showError('Erro ao carregar gastos.')
    } finally {
      setLoading(false)
    }
  }, [mes, showError])

  useEffect(() => { carregar() }, [carregar])

  const anotar = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parseNumericInput(valor)
    if (amount === null || amount <= 0) return showError('Informe o valor do gasto.')
    if (!descricao.trim()) return showError('Informe o que foi o gasto.')

    setSalvando(true)
    try {
      await expensesApi.create({ amount, description: descricao.trim(), spent_on: dia })
      setValor('')
      setDescricao('')
      success('Gasto anotado!')
      // Gasto lançado em outro mês: leva até ele em vez de "sumir" da lista.
      if (dia.slice(0, 7) !== mes) setMes(dia.slice(0, 7))
      else carregar()
    } catch {
      showError('Erro ao anotar gasto.')
    } finally {
      setSalvando(false)
    }
  }

  const confirmarApagar = async () => {
    if (!apagar) return
    setApagando(true)
    try {
      await expensesApi.delete(apagar.id)
      setGastos((prev) => prev.filter((g) => g.id !== apagar.id))
      setTotal((t) => t - apagar.amount)
      success('Gasto excluído.')
      setApagar(null)
    } catch {
      showError('Erro ao excluir gasto.')
    } finally {
      setApagando(false)
    }
  }

  const nomeMes = formatDate(`${mes}-01`, "MMMM 'de' yyyy")

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Anotar */}
      <form onSubmit={anotar} className="glass-card rounded-2xl border border-outline-variant/50 p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr_160px] gap-3">
          <NumberField
            label="Valor"
            required
            mode="currency"
            min={0}
            prefix="R$"
            placeholder="0,00"
            value={valor}
            onChange={setValor}
          />
          <div>
            <label className="label" htmlFor="gasto-descricao">O que foi *</label>
            <input
              id="gasto-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              maxLength={120}
              placeholder="Mercado, café, farmácia…"
              className="input-field"
            />
          </div>
          <div>
            <label className="label" htmlFor="gasto-dia">Dia</label>
            <input
              id="gasto-dia"
              type="date"
              value={dia}
              max={hojeLocal()}
              onChange={(e) => setDia(e.target.value)}
              className="input-field"
            />
          </div>
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-on-surface-variant">
            Também dá pelo WhatsApp: <code className="px-1.5 py-0.5 rounded bg-surface-container text-primary font-mono">/gasto 45 mercado</code>
          </p>
          <button type="submit" disabled={salvando} className="btn-primary justify-center w-full sm:w-auto">
            <span className="material-symbols-outlined text-lg">add</span>
            {salvando ? 'Anotando…' : 'Anotar gasto'}
          </button>
        </div>
      </form>

      {/* Mês */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMes(somarMeses(mes, -1))}
            className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-on-surface-variant cursor-pointer"
            aria-label="Mês anterior"
          >
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <span className="text-sm font-semibold text-on-surface capitalize min-w-[140px] text-center">{nomeMes}</span>
          <button
            onClick={() => setMes(somarMeses(mes, 1))}
            disabled={mes >= mesAtual}
            className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-on-surface-variant disabled:opacity-30 cursor-pointer disabled:cursor-default"
            aria-label="Próximo mês"
          >
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-primary/15 text-primary text-xs font-semibold">
          TOTAL {formatBRL(total)}
        </span>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : gastos.length === 0 ? (
        <div className="glass-card rounded-2xl border border-outline-variant/50 p-12 text-center">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-4 block">payments</span>
          <h3 className="text-base font-semibold text-on-surface mb-2">Nenhum gasto neste mês</h3>
          <p className="text-sm text-on-surface-variant">
            Anote acima ou mande <code className="font-mono text-primary">/gasto 45 mercado</code> no WhatsApp.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {porDia(gastos).map(({ dia: d, itens }) => (
            <section key={d}>
              <h3 className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-2">
                {formatDate(d, "EEEE, dd/MM")}
              </h3>
              <ul className="glass-card rounded-2xl border border-outline-variant/50 divide-y divide-outline-variant/30">
                {itens.map((g) => (
                  <li key={g.id} className="flex items-center gap-3 pl-4 pr-1.5 py-1.5">
                    <span
                      className="material-symbols-outlined text-base text-on-surface-variant"
                      title={g.source === 'whatsapp' ? 'Anotado pelo WhatsApp' : 'Anotado no app'}
                    >
                      {g.source === 'whatsapp' ? 'chat' : 'edit_note'}
                    </span>
                    <span className="flex-1 min-w-0 text-sm text-on-surface truncate">{g.description}</span>
                    <span className="text-sm font-semibold text-on-surface">{formatBRL(g.amount)}</span>
                    <button
                      onClick={() => setApagar(g)}
                      className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-error cursor-pointer"
                      aria-label={`Excluir gasto ${g.description}`}
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Modal
        isOpen={!!apagar}
        onClose={() => setApagar(null)}
        onConfirm={confirmarApagar}
        title="Excluir gasto"
        description={`Excluir "${apagar?.description}" de ${apagar ? formatBRL(apagar.amount) : ''}?`}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        loading={apagando}
      />
    </div>
  )
}

export default ContasGastos
