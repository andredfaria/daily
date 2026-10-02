import React, { useState } from 'react'
import { expensesApi } from '../../api/expenses'
import { ICONES_CATEGORIA, type CategoriaGasto } from '../../utils/categoriasGasto'
import Modal from '../ui/Modal'
import { useToast } from '../../context/ToastContext'

const erroDaApi = (err: any, padrao: string): string => err?.response?.data?.error ?? padrao

interface EditorProps {
  nomeInicial: string
  iconeInicial: string
  rotuloSalvar: string
  onSalvar: (nome: string, icone: string) => Promise<boolean>
  onCancelar: () => void
}

/** Nome + grade de ícones; serve para criar e para editar. Esc cancela. */
const EditorCategoria: React.FC<EditorProps> = ({ nomeInicial, iconeInicial, rotuloSalvar, onSalvar, onCancelar }) => {
  const [nome, setNome] = useState(nomeInicial)
  const [icone, setIcone] = useState(iconeInicial)
  const [salvando, setSalvando] = useState(false)

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    setSalvando(true)
    const ok = await onSalvar(nome, icone)
    if (!ok) setSalvando(false)
  }

  return (
    <form onSubmit={salvar} onKeyDown={(e) => e.key === 'Escape' && onCancelar()} className="space-y-3 p-4 bg-surface-container/40">
      <div>
        <label className="label" htmlFor="categoria-nome">Nome</label>
        <input
          id="categoria-nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          maxLength={30}
          autoFocus
          placeholder="Pet, Filhos, Viagem…"
          className="input-field"
        />
      </div>
      <fieldset>
        <legend className="label">Ícone</legend>
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
          {ICONES_CATEGORIA.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIcone(i)}
              aria-pressed={icone === i}
              aria-label={`Ícone ${i}`}
              className={`h-11 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                icone === i ? 'bg-primary text-on-primary-fixed' : 'bg-surface-container text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-lg">{i}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancelar} className="btn-ghost min-h-[44px]">Cancelar</button>
        <button type="submit" disabled={salvando} className="btn-primary min-h-[44px]">
          {salvando ? 'Salvando…' : rotuloSalvar}
        </button>
      </div>
    </form>
  )
}

interface Props {
  categorias: CategoriaGasto[]
  onMudou: (categorias: CategoriaGasto[], gastosMudaram?: boolean) => void
  onFechar: () => void
}

/**
 * Criar, renomear, trocar ícone, ocultar e apagar categorias de gasto.
 * Padrão só se oculta (some das listas de escolha e da dedução automática);
 * apagar é só para as criadas, e os gastos delas vão para "Outro".
 */
const GerenciarCategorias: React.FC<Props> = ({ categorias, onMudou, onFechar }) => {
  const [editando, setEditando] = useState<string | 'nova' | null>(null)
  const [apagar, setApagar] = useState<CategoriaGasto | null>(null)
  const [apagando, setApagando] = useState(false)
  const [alternando, setAlternando] = useState<string | null>(null)
  const { success, error: showError } = useToast()
  const nomeReserva = categorias.find((c) => c.key === 'outro')?.nome ?? 'Outro'

  const criar = async (name: string, icon: string) => {
    try {
      onMudou(await expensesApi.criarCategoria({ name, icon }))
      success('Categoria criada!')
      setEditando(null)
      return true
    } catch (err) {
      showError(erroDaApi(err, 'Erro ao criar categoria.'))
      return false
    }
  }

  const salvar = async (key: string, name: string, icon: string) => {
    try {
      onMudou(await expensesApi.atualizarCategoria(key, { name, icon }))
      success('Categoria atualizada!')
      setEditando(null)
      return true
    } catch (err) {
      showError(erroDaApi(err, 'Erro ao salvar categoria.'))
      return false
    }
  }

  const alternarOculta = async (c: CategoriaGasto) => {
    setAlternando(c.key)
    try {
      onMudou(await expensesApi.atualizarCategoria(c.key, { hidden: !c.oculta }))
    } catch (err) {
      showError(erroDaApi(err, 'Erro ao atualizar categoria.'))
    } finally {
      setAlternando(null)
    }
  }

  const confirmarApagar = async () => {
    if (!apagar) return
    setApagando(true)
    try {
      const r = await expensesApi.apagarCategoria(apagar.key)
      onMudou(r.categorias, r.gastosMovidos > 0)
      success(r.gastosMovidos > 0 ? `Categoria apagada. ${r.gastosMovidos} gasto(s) foram para ${nomeReserva}.` : 'Categoria apagada.')
      setApagar(null)
    } catch (err) {
      showError(erroDaApi(err, 'Erro ao apagar categoria.'))
    } finally {
      setApagando(false)
    }
  }

  return (
    <section className="glass-card rounded-2xl border border-outline-variant/50" aria-label="Gerenciar categorias">
      <div className="flex items-center justify-between gap-3 pl-5 pr-2 py-2 border-b border-outline-variant/30">
        <h3 className="text-sm font-semibold text-on-surface">Categorias</h3>
        <button
          onClick={onFechar}
          className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-on-surface-variant cursor-pointer"
          aria-label="Fechar categorias"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      <ul className="divide-y divide-outline-variant/30">
        {categorias.map((c) =>
          editando === c.key ? (
            <li key={c.key}>
              <EditorCategoria
                nomeInicial={c.nome}
                iconeInicial={c.icone}
                rotuloSalvar="Salvar"
                onSalvar={(nome, icone) => salvar(c.key, nome, icone)}
                onCancelar={() => setEditando(null)}
              />
            </li>
          ) : (
            <li key={c.key} className={`flex items-center gap-3 pl-4 pr-1.5 py-1.5 ${c.oculta ? 'opacity-50' : ''}`}>
              <span className="w-9 h-9 shrink-0 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-lg">{c.icone}</span>
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-on-surface truncate">{c.nome}</span>
                <span className="block text-[11px] text-on-surface-variant">
                  {c.oculta ? 'Oculta' : c.padrao ? 'Padrão' : 'Criada por você'}
                </span>
              </span>
              <button
                onClick={() => setEditando(c.key)}
                className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-primary cursor-pointer"
                aria-label={`Editar categoria ${c.nome}`}
              >
                <span className="material-symbols-outlined text-base">edit</span>
              </button>
              {c.key !== 'outro' && (
                <button
                  onClick={() => alternarOculta(c)}
                  disabled={alternando === c.key}
                  className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface disabled:opacity-40 cursor-pointer"
                  aria-label={c.oculta ? `Mostrar categoria ${c.nome}` : `Ocultar categoria ${c.nome}`}
                  title={c.oculta ? 'Mostrar' : 'Ocultar'}
                >
                  <span className="material-symbols-outlined text-base">{c.oculta ? 'visibility' : 'visibility_off'}</span>
                </button>
              )}
              {!c.padrao && (
                <button
                  onClick={() => setApagar(c)}
                  className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-on-surface-variant hover:text-error cursor-pointer"
                  aria-label={`Apagar categoria ${c.nome}`}
                >
                  <span className="material-symbols-outlined text-base">delete</span>
                </button>
              )}
            </li>
          ),
        )}
      </ul>

      {editando === 'nova' ? (
        <div className="border-t border-outline-variant/30">
          <EditorCategoria
            nomeInicial=""
            iconeInicial="more_horiz"
            rotuloSalvar="Criar"
            onSalvar={criar}
            onCancelar={() => setEditando(null)}
          />
        </div>
      ) : (
        <div className="p-3 border-t border-outline-variant/30">
          <button onClick={() => setEditando('nova')} className="btn-ghost w-full justify-center min-h-[44px]">
            <span className="material-symbols-outlined text-lg">add</span>
            Nova categoria
          </button>
        </div>
      )}

      <p className="px-5 pb-4 text-[11px] text-on-surface-variant/80 leading-relaxed">
        Categoria oculta some das opções e da escolha automática, mas os gastos antigos continuam nela.
        No WhatsApp, use o nome com <code className="font-mono text-primary">#</code>: <code className="font-mono text-primary">/gasto 50 ração #pet</code>.
      </p>

      <Modal
        isOpen={!!apagar}
        onClose={() => setApagar(null)}
        onConfirm={confirmarApagar}
        title="Apagar categoria"
        description={`Apagar "${apagar?.nome}"? Os gastos dela passam para ${nomeReserva}.`}
        confirmLabel="Apagar"
        cancelLabel="Cancelar"
        variant="danger"
        loading={apagando}
      />
    </section>
  )
}

export default GerenciarCategorias
