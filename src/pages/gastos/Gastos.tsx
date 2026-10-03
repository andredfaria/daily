import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { expensesApi, type DadosGasto } from '../../api/expenses'
import type { Expense } from '../../types'
import { formatBRL, formatDate } from '../../utils/format'
import { formatNumericInput, parseNumericInput } from '../../utils/numberInput'
import NumberField from '../../components/ui/NumberField'
import Modal from '../../components/ui/Modal'
import { SkeletonCard } from '../../components/ui/Skeleton'
import { useToast } from '../../context/ToastContext'
import { useAuth } from '../../context/AuthContext'
import { infoCategoria, type CategoriaGasto } from '../../utils/categoriasGasto'
import GerenciarCategorias from '../../components/contas/GerenciarCategorias'
import DiaADiaGastos from '../../components/contas/DiaADiaGastos'
import { resumoDiario } from '../../utils/gastosDiarios'

const hojeLocal = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const somarMeses = (mes: string, n: number): string => {
  const [a, m] = mes.split('-').map(Number)
  const d = new Date(a, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Total do mês contra o limite de gastos — separado do limite das contas. */
const LimiteGastos: React.FC<{ total: number; limite: number | null }> = ({ total, limite }) => {
  if (limite === null) {
    return (
      <Link to="/configuracoes" className="inline-block text-xs text-primary hover:text-primary/80 font-medium">
        Definir limite mensal de gastos →
      </Link>
    )
  }
  const estourou = total > limite
  const pct = limite > 0 ? Math.min(100, Math.round((total / limite) * 100)) : 100
  return (
    <div className="space-y-1.5">
      <div
        className="h-2 rounded-full bg-surface-container overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Limite de gastos usado"
      >
        <div className={`h-full rounded-full ${estourou ? 'bg-error' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
      </div>
      <p className={`text-xs ${estourou ? 'text-error' : 'text-on-surface-variant'}`}>
        {estourou
          ? `${formatBRL(total - limite)} acima do limite de ${formatBRL(limite)}`
          : `${formatBRL(limite - total)} restantes do limite de ${formatBRL(limite)}`}
      </p>
    </div>
  )
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

interface SeletorProps {
  id: string
  valor: string
  onChange: (valor: string) => void
  categorias: CategoriaGasto[]
  /** Mostra a opção "Automática" (o backend deduz pela descrição). */
  automatica?: boolean
}

/** Só categorias visíveis — e a atual, se estiver oculta, para editar gasto antigo sem trocá-la. */
const SeletorCategoria: React.FC<SeletorProps> = ({ id, valor, onChange, categorias, automatica }) => (
  <div>
    <label className="label" htmlFor={id}>Categoria</label>
    <select id={id} value={valor} onChange={(e) => onChange(e.target.value)} className="input-field">
      {automatica && <option value="">Automática (pelo nome)</option>}
      {categorias
        .filter((c) => !c.oculta || c.key === valor)
        .map((c) => (
          <option key={c.key} value={c.key}>{c.nome}</option>
        ))}
    </select>
  </div>
)

/** Total por categoria, do maior para o menor. Chave de categoria apagada soma em "outro". */
function totaisPorCategoria(gastos: Expense[], categorias: CategoriaGasto[]): Array<{ categoria: string; total: number }> {
  const mapa = new Map<string, number>()
  for (const g of gastos) {
    const key = infoCategoria(g.category, categorias).key
    mapa.set(key, (mapa.get(key) ?? 0) + g.amount)
  }
  return [...mapa.entries()]
    .map(([categoria, total]) => ({ categoria, total: Math.round(total * 100) / 100 }))
    .sort((a, b) => b.total - a.total)
}

interface EdicaoProps {
  gasto: Expense
  categorias: CategoriaGasto[]
  onSalvar: (dados: DadosGasto) => Promise<boolean>
  onCancelar: () => void
}

/** A linha vira formulário no lugar; Esc cancela. */
const EdicaoGasto: React.FC<EdicaoProps> = ({ gasto, categorias, onSalvar, onCancelar }) => {
  const [valor, setValor] = useState(formatNumericInput(gasto.amount, 2, { padDecimals: true }))
  const [descricao, setDescricao] = useState(gasto.description)
  const [categoria, setCategoria] = useState(infoCategoria(gasto.category, categorias).key)
  const [dia, setDia] = useState(gasto.spent_on)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parseNumericInput(valor)
    if (amount === null || amount <= 0) return setErro('Informe o valor.')
    if (!descricao.trim()) return setErro('Informe o que foi o gasto.')
    setSalvando(true)
    const ok = await onSalvar({ amount, description: descricao.trim(), category: categoria || undefined, spent_on: dia })
    if (!ok) setSalvando(false)
  }

  return (
    <li className="p-4 bg-surface-container/40">
      <form
        onSubmit={salvar}
        onKeyDown={(e) => e.key === 'Escape' && onCancelar()}
        className="space-y-3"
        aria-label={`Editar gasto ${gasto.description}`}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <NumberField label="Valor" mode="currency" min={0} prefix="R$" value={valor} onChange={setValor} />
          <div>
            <label className="label" htmlFor={`desc-${gasto.id}`}>O que foi</label>
            <input
              id={`desc-${gasto.id}`}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              maxLength={120}
              autoFocus
              className="input-field"
            />
          </div>
          <SeletorCategoria id={`cat-${gasto.id}`} valor={categoria} onChange={setCategoria} categorias={categorias} />
          <div>
            <label className="label" htmlFor={`dia-${gasto.id}`}>Dia</label>
            <input
              id={`dia-${gasto.id}`}
              type="date"
              value={dia}
              max={hojeLocal()}
              onChange={(e) => setDia(e.target.value)}
              className="input-field"
            />
          </div>
        </div>
        {erro && <p className="text-xs text-error">{erro}</p>}
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancelar} className="btn-ghost min-h-[44px]">Cancelar</button>
          <button type="submit" disabled={salvando} className="btn-primary min-h-[44px]">
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </li>
  )
}

const Gastos: React.FC = () => {
  const mesAtual = hojeLocal().slice(0, 7)
  const [mes, setMes] = useState(mesAtual)
  const [gastos, setGastos] = useState<Expense[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [categoria, setCategoria] = useState('')
  const [dia, setDia] = useState(hojeLocal())
  const [filtro, setFiltro] = useState<string | null>(null)
  const [diaFiltro, setDiaFiltro] = useState<string | null>(null)
  const [categorias, setCategorias] = useState<CategoriaGasto[]>([])
  const [gerenciando, setGerenciando] = useState(false)
  const [salvando, setSalvando] = useState(false)

  const [editando, setEditando] = useState<string | null>(null)
  const [apagar, setApagar] = useState<Expense | null>(null)
  const [apagando, setApagando] = useState(false)
  const { success, error: showError } = useToast()
  const { user } = useAuth()
  const limiteGastos = user?.monthly_expense_budget_limit != null ? Number(user.monthly_expense_budget_limit) : null

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
  // Dia escolhido no gráfico é do mês que estava aberto.
  useEffect(() => { setDiaFiltro(null) }, [mes])

  useEffect(() => {
    expensesApi.categorias().then(setCategorias).catch(() => showError('Erro ao carregar categorias.'))
  }, [showError])

  const categoriasMudaram = (novas: CategoriaGasto[], gastosMudaram?: boolean) => {
    setCategorias(novas)
    // Categoria apagada leva os gastos para "outro": a lista precisa refletir.
    if (gastosMudaram) carregar()
  }

  const anotar = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parseNumericInput(valor)
    if (amount === null || amount <= 0) return showError('Informe o valor do gasto.')
    if (!descricao.trim()) return showError('Informe o que foi o gasto.')

    setSalvando(true)
    try {
      await expensesApi.create({ amount, description: descricao.trim(), category: categoria || undefined, spent_on: dia })
      setValor('')
      setDescricao('')
      setCategoria('')
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

  const salvarEdicao = async (id: string, dados: DadosGasto) => {
    try {
      await expensesApi.update(id, dados)
      success('Gasto atualizado!')
      setEditando(null)
      // Dia trocado pode mudar a ordem, o agrupamento ou até o mês: recarrega.
      carregar()
      return true
    } catch {
      showError('Erro ao salvar gasto.')
      return false
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

  const totais = totaisPorCategoria(gastos, categorias)
  // Filtro de categoria que sumiu (mês trocado, gasto apagado) deixa de valer.
  const filtroAtivo = filtro && totais.some((t) => t.categoria === filtro) ? filtro : null
  const daCategoria = filtroAtivo ? gastos.filter((g) => infoCategoria(g.category, categorias).key === filtroAtivo) : gastos
  // Gráfico segue a categoria; o dia filtra só a lista, senão o gráfico viraria uma barra.
  const resumo = resumoDiario(daCategoria, mes, hojeLocal())
  const diaAtivo = diaFiltro && daCategoria.some((g) => g.spent_on === diaFiltro) ? diaFiltro : null
  const visiveis = diaAtivo ? daCategoria.filter((g) => g.spent_on === diaAtivo) : daCategoria

  const nomeMes = formatDate(`${mes}-01`, "MMMM 'de' yyyy").replace(/^./, (c) => c.toUpperCase())

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Anotar */}
      <form onSubmit={anotar} className="glass-card rounded-2xl border border-outline-variant/50 p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
          <SeletorCategoria id="gasto-categoria" valor={categoria} onChange={setCategoria} categorias={categorias} automatica />
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
        <span className="px-2.5 py-1 rounded-full bg-primary/15 text-primary text-xs font-semibold">
          TOTAL {formatBRL(total)}
        </span>
      </div>
      {!loading && <LimiteGastos total={total} limite={limiteGastos} />}

      {/* Por categoria — tocar filtra a lista. O gerenciador vem primeiro: no fim
          da faixa rolável ele ficava escondido no celular. */}
      {gerenciando ? (
        <GerenciarCategorias categorias={categorias} onMudou={categoriasMudaram} onFechar={() => setGerenciando(false)} />
      ) : !loading && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap" role="group" aria-label="Filtrar por categoria">
          <button
            onClick={() => setGerenciando(true)}
            className="shrink-0 flex items-center gap-1.5 min-h-[44px] px-3 rounded-xl text-xs font-semibold border border-dashed border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary/50 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">tune</span>
            Categorias
          </button>
          {totais.map(({ categoria: c, total: t }) => {
            const info = infoCategoria(c, categorias)
            const ativo = filtroAtivo === c
            return (
              <button
                key={c}
                onClick={() => setFiltro(ativo ? null : c)}
                aria-pressed={ativo}
                className={`shrink-0 flex items-center gap-1.5 min-h-[44px] px-3 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                  ativo ? 'bg-primary text-on-primary-fixed' : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-base">{info.icone}</span>
                {info.nome}
                <span className={ativo ? '' : 'text-on-surface'}>{formatBRL(t)}</span>
              </button>
            )
          })}
        </div>
      )}

      {!loading && gastos.length > 0 && (
        <DiaADiaGastos
          resumo={resumo}
          categoria={filtroAtivo ? infoCategoria(filtroAtivo, categorias).nome : null}
          diaSelecionado={diaAtivo}
          onSelecionarDia={setDiaFiltro}
        />
      )}

      {diaAtivo && (
        <button
          onClick={() => setDiaFiltro(null)}
          className="flex items-center gap-1.5 min-h-[44px] px-3 rounded-xl text-xs font-semibold bg-primary/15 text-primary hover:bg-primary/25 transition-colors cursor-pointer"
        >
          <span className="capitalize">Só {formatDate(diaAtivo, "EEEE, dd/MM")}</span>
          <span className="material-symbols-outlined text-base" aria-hidden="true">close</span>
          <span className="sr-only">— mostrar o mês inteiro</span>
        </button>
      )}

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
          {porDia(visiveis).map(({ dia: d, itens }) => (
            <section key={d}>
              <h3 className="flex items-baseline justify-between gap-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wide mb-2 pr-1.5">
                <span>{formatDate(d, "EEEE, dd/MM")}</span>
                <span className="normal-case tabular-nums">{formatBRL(itens.reduce((s, g) => s + g.amount, 0))}</span>
              </h3>
              <ul className="glass-card rounded-2xl border border-outline-variant/50 divide-y divide-outline-variant/30">
                {itens.map((g) => editando === g.id ? (
                  <EdicaoGasto
                    key={g.id}
                    gasto={g}
                    categorias={categorias}
                    onSalvar={(dados) => salvarEdicao(g.id, dados)}
                    onCancelar={() => setEditando(null)}
                  />
                ) : (
                  <li key={g.id} className="flex items-center gap-3 pl-3 pr-1.5 py-1.5">
                    <span className="w-9 h-9 shrink-0 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                      <span className="material-symbols-outlined text-lg">{infoCategoria(g.category, categorias).icone}</span>
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-on-surface truncate">{g.description}</span>
                      <span className="flex items-center gap-1 whitespace-nowrap text-[11px] text-on-surface-variant">
                        {infoCategoria(g.category, categorias).nome}
                        {g.source === 'whatsapp' && (
                          <span
                            className="material-symbols-outlined text-xs"
                            title="Anotado pelo WhatsApp"
                            aria-label="anotado pelo WhatsApp"
                            role="img"
                          >
                            chat
                          </span>
                        )}
                      </span>
                    </span>
                    <span className="text-sm font-semibold text-on-surface">{formatBRL(g.amount)}</span>
                    <button
                      onClick={() => setEditando(g.id)}
                      className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-primary cursor-pointer"
                      aria-label={`Editar gasto ${g.description}`}
                    >
                      <span className="material-symbols-outlined text-base">edit</span>
                    </button>
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

export default Gastos
