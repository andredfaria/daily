import React, { useState } from 'react'
import { formatBRL, formatDate } from '../../utils/format'
import { formatNumericInput, parseNumericInput } from '../../utils/numberInput'
import { ordenarMetas, situacaoMeta, type MetaPeriodo } from '../../utils/metasPeriodo'
import type { DadosMetaPeriodo } from '../../api/expenseGoals'
import NumberField from '../ui/NumberField'
import Modal from '../ui/Modal'

interface Props {
  metas: MetaPeriodo[]
  hoje: string
  onCriar: (dados: DadosMetaPeriodo) => Promise<boolean>
  onAtualizar: (id: string, dados: DadosMetaPeriodo) => Promise<boolean>
  onApagar: (id: string) => Promise<boolean>
}

/** Encerradas à vista antes do "ver mais". */
const ENCERRADAS_VISIVEIS = 2

const periodo = (m: { start_date: string; end_date: string }) =>
  m.start_date === m.end_date
    ? formatDate(m.start_date, 'dd/MM/yy')
    : `${formatDate(m.start_date, 'dd/MM')} a ${formatDate(m.end_date, 'dd/MM/yy')}`

const FormMeta: React.FC<{
  inicial?: MetaPeriodo
  hoje: string
  onSalvar: (dados: DadosMetaPeriodo) => Promise<boolean>
  onCancelar: () => void
}> = ({ inicial, hoje, onSalvar, onCancelar }) => {
  const [nome, setNome] = useState(inicial?.name ?? '')
  const [inicio, setInicio] = useState(inicial?.start_date ?? hoje)
  const [fim, setFim] = useState(inicial?.end_date ?? hoje)
  const [valor, setValor] = useState(inicial ? formatNumericInput(inicial.amount, 2, { padDecimals: true }) : '')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)
  const id = inicial?.id ?? 'nova'

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parseNumericInput(valor)
    if (!nome.trim()) return setErro('Dê um nome para a meta.')
    if (!inicio || !fim) return setErro('Informe início e fim.')
    if (fim < inicio) return setErro('O fim não pode ser antes do início.')
    if (amount === null || amount <= 0) return setErro('Informe o valor da meta.')
    setErro(null)
    setSalvando(true)
    const ok = await onSalvar({ name: nome.trim(), start_date: inicio, end_date: fim, amount })
    if (!ok) setSalvando(false)
  }

  return (
    <form
      onSubmit={salvar}
      onKeyDown={(e) => e.key === 'Escape' && onCancelar()}
      className="space-y-3 rounded-xl bg-surface-container/40 p-3"
      aria-label={inicial ? `Editar meta ${inicial.name}` : 'Nova meta por período'}
    >
      <div>
        <label className="label" htmlFor={`meta-nome-${id}`}>Nome</label>
        <input
          id={`meta-nome-${id}`}
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          maxLength={60}
          placeholder="Viagem, feriado, aniversário…"
          autoFocus
          className="input-field"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor={`meta-inicio-${id}`}>Início</label>
          <input
            id={`meta-inicio-${id}`}
            type="date"
            value={inicio}
            onChange={(e) => {
              setInicio(e.target.value)
              // Fim antes do novo início acompanha, para não travar no erro.
              if (e.target.value && fim < e.target.value) setFim(e.target.value)
            }}
            className="input-field"
          />
        </div>
        <div>
          <label className="label" htmlFor={`meta-fim-${id}`}>Fim</label>
          <input
            id={`meta-fim-${id}`}
            type="date"
            value={fim}
            min={inicio}
            onChange={(e) => setFim(e.target.value)}
            className="input-field"
          />
        </div>
      </div>
      <NumberField label="Meta" mode="currency" min={0} prefix="R$" placeholder="0,00" value={valor} onChange={setValor} />
      {erro && <p className="text-xs text-error">{erro}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancelar} className="btn-ghost min-h-[44px]">Cancelar</button>
        <button type="submit" disabled={salvando} className="btn-primary min-h-[44px]">
          {salvando ? 'Salvando…' : inicial ? 'Salvar' : 'Criar meta'}
        </button>
      </div>
    </form>
  )
}

const ItemMeta: React.FC<{ meta: MetaPeriodo; hoje: string; onEditar: () => void; onApagar: () => void }> = ({
  meta, hoje, onEditar, onApagar,
}) => {
  const s = situacaoMeta(meta, hoje)
  const pct = meta.amount > 0 ? Math.min(100, Math.round((meta.spent / meta.amount) * 100)) : 100

  let detalhe: string
  if (s.estado === 'futura') {
    detalhe = `Começa ${formatDate(meta.start_date, 'dd/MM')} · ${s.dias === 1 ? '1 dia' : `${s.dias} dias`}`
  } else if (s.estourou) {
    detalhe = `${formatBRL(-s.disponivel)} acima da meta`
  } else if (s.estado === 'andamento') {
    detalhe = s.diasRestantes === 1
      ? `${formatBRL(s.disponivel)} disponíveis hoje, último dia`
      : `${formatBRL(s.disponivel)} disponíveis · ${formatBRL(s.porDia ?? 0)}/dia nos ${s.diasRestantes} dias que faltam`
  } else {
    detalhe = `Fechou ${formatBRL(s.disponivel)} abaixo da meta`
  }

  return (
    <li className={`space-y-1.5 ${s.estado === 'encerrada' ? 'opacity-80' : ''}`}>
      <div className="flex items-center gap-2">
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-1.5 text-sm text-on-surface">
            <span className="truncate font-medium">{meta.name}</span>
            {s.estado === 'andamento' && (
              <span className="shrink-0 px-1.5 py-0.5 rounded bg-primary/15 text-primary text-[10px] font-semibold uppercase">agora</span>
            )}
          </span>
          <span className="block text-[11px] text-on-surface-variant">{periodo(meta)}</span>
        </span>
        <span className="text-right">
          <span className={`block text-sm font-semibold tabular-nums ${s.estourou ? 'text-error' : 'text-on-surface'}`}>
            {formatBRL(meta.spent)}
          </span>
          <span className="block text-[11px] text-on-surface-variant tabular-nums">de {formatBRL(meta.amount)}</span>
        </span>
        <button
          onClick={onEditar}
          className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-primary cursor-pointer"
          aria-label={`Editar meta ${meta.name}`}
        >
          <span className="material-symbols-outlined text-base">edit</span>
        </button>
        <button
          onClick={onApagar}
          className="w-11 h-11 shrink-0 -ml-2 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-error cursor-pointer"
          aria-label={`Excluir meta ${meta.name}`}
        >
          <span className="material-symbols-outlined text-base">delete</span>
        </button>
      </div>
      {s.estado !== 'futura' && (
        <div
          className="h-1.5 rounded-full bg-surface-container overflow-hidden"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Meta ${meta.name} usada`}
        >
          <div className={`h-full rounded-full ${s.estourou ? 'bg-error' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
        </div>
      )}
      <p className={`text-xs ${s.estourou ? 'text-error' : 'text-on-surface-variant'}`}>{detalhe}</p>
    </li>
  )
}

/** Metas avulsas com início e fim (viagem, feriado); gasto somado pelo backend. */
const MetasPeriodoGastos: React.FC<Props> = ({ metas, hoje, onCriar, onAtualizar, onApagar }) => {
  const [form, setForm] = useState<'nova' | string | null>(null)
  const [todas, setTodas] = useState(false)
  const [apagar, setApagar] = useState<MetaPeriodo | null>(null)
  const [apagando, setApagando] = useState(false)

  const ordenadas = ordenarMetas(metas, hoje)
  const encerradas = ordenadas.filter((m) => situacaoMeta(m, hoje).estado === 'encerrada')
  const ativas = ordenadas.filter((m) => situacaoMeta(m, hoje).estado !== 'encerrada')
  const encerradasVisiveis = todas ? encerradas : encerradas.slice(0, ENCERRADAS_VISIVEIS)
  const mostradas = [...ativas, ...encerradasVisiveis]
  // A meta em edição continua à vista mesmo se for uma encerrada escondida.
  const emEdicao = form && form !== 'nova' ? metas.find((m) => m.id === form) : undefined
  if (emEdicao && !mostradas.includes(emEdicao)) mostradas.push(emEdicao)

  const confirmarApagar = async () => {
    if (!apagar) return
    setApagando(true)
    if (await onApagar(apagar.id)) setApagar(null)
    setApagando(false)
  }

  if (metas.length === 0 && form !== 'nova') {
    return (
      <button
        onClick={() => setForm('nova')}
        className="flex items-center gap-1.5 min-h-[44px] px-3 rounded-xl text-xs font-semibold border border-dashed border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary/50 transition-colors cursor-pointer"
      >
        <span className="material-symbols-outlined text-base">event</span>
        Meta para um período (viagem, feriado…)
      </button>
    )
  }

  return (
    <section className="glass-card rounded-2xl border border-outline-variant/50 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-on-surface">Metas por período</h2>
          <p className="text-xs text-on-surface-variant">Todos os gastos entre o início e o fim, de qualquer categoria.</p>
        </div>
        {form === null && (
          <button
            onClick={() => setForm('nova')}
            className="w-11 h-11 shrink-0 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-primary cursor-pointer"
            aria-label="Nova meta por período"
          >
            <span className="material-symbols-outlined text-base">add</span>
          </button>
        )}
      </div>

      {form === 'nova' && (
        <FormMeta
          hoje={hoje}
          onSalvar={async (dados) => {
            const ok = await onCriar(dados)
            if (ok) setForm(null)
            return ok
          }}
          onCancelar={() => setForm(null)}
        />
      )}

      {mostradas.length > 0 && (
        <ul className="space-y-4">
          {mostradas.map((m) => form === m.id ? (
            <li key={m.id}>
              <FormMeta
                inicial={m}
                hoje={hoje}
                onSalvar={async (dados) => {
                  const ok = await onAtualizar(m.id, dados)
                  if (ok) setForm(null)
                  return ok
                }}
                onCancelar={() => setForm(null)}
              />
            </li>
          ) : (
            <ItemMeta key={m.id} meta={m} hoje={hoje} onEditar={() => setForm(m.id)} onApagar={() => setApagar(m)} />
          ))}
        </ul>
      )}

      {encerradas.length > ENCERRADAS_VISIVEIS && (
        <button
          onClick={() => setTodas((t) => !t)}
          className="text-xs text-primary hover:text-primary/80 font-medium cursor-pointer"
        >
          {todas ? 'Mostrar menos' : `Ver mais ${encerradas.length - ENCERRADAS_VISIVEIS} encerradas`}
        </button>
      )}

      <Modal
        isOpen={!!apagar}
        onClose={() => setApagar(null)}
        onConfirm={confirmarApagar}
        title="Excluir meta"
        description={`Excluir a meta "${apagar?.name}"? Os gastos continuam anotados.`}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        loading={apagando}
      />
    </section>
  )
}

export default MetasPeriodoGastos
