import React, { useCallback, useEffect, useRef, useState } from 'react'
import { getAtividade } from '../../api/admin'
import { corStatus, rotuloAtividade } from '../../utils/atividade'
import type { FiltrosAtividade, LinhaAtividade } from '../../types'

const SELO: Record<'ok' | 'erro' | 'aviso', { texto: string; classe: string }> = {
  ok: { texto: 'ok', classe: 'bg-primary/15 text-primary' },
  erro: { texto: 'falha', classe: 'bg-error/15 text-error' },
  aviso: { texto: 'ignorado', classe: 'bg-tertiary/15 text-tertiary' },
}

const hora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

export const SeloStatus: React.FC<{ status: string }> = ({ status }) => {
  const s = SELO[corStatus(status)]
  return <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${s.classe}`}>{s.texto}</span>
}

const Linha: React.FC<{ item: LinhaAtividade; mostrarUsuario: boolean }> = ({ item, mostrarUsuario }) => {
  const [aberta, setAberta] = useState(false)
  const texto = [item.error, item.detail].filter(Boolean).join('\n\n')
  const meta = item.meta && Object.keys(item.meta).length > 0 ? JSON.stringify(item.meta, null, 2) : ''
  const temDetalhe = !!texto || !!meta
  return (
    <li className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest">
      <button
        type="button"
        disabled={!temDetalhe}
        onClick={() => setAberta((v) => !v)}
        aria-expanded={temDetalhe ? aberta : undefined}
        className="w-full text-left p-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3 min-h-[44px] disabled:cursor-default"
      >
        <span className="text-xs text-on-surface-variant tabular-nums sm:w-28 flex-shrink-0">{hora(item.created_at)}</span>
        {mostrarUsuario && (
          <span className="text-sm text-on-surface sm:w-32 flex-shrink-0 truncate">{item.user_name ?? '—'}</span>
        )}
        <span className="text-sm font-medium text-on-surface flex-1 min-w-0 truncate">
          {rotuloAtividade(item.kind, item.ref)}
        </span>
        <span className="flex items-center gap-2">
          <SeloStatus status={item.status} />
          {temDetalhe && (
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
              {aberta ? 'expand_less' : 'expand_more'}
            </span>
          )}
        </span>
      </button>
      {aberta && (
        <pre className="px-3 pb-3 text-xs text-on-surface-variant whitespace-pre-wrap break-words font-mono">
          {[texto, meta].filter(Boolean).join('\n\n')}
        </pre>
      )}
    </li>
  )
}

interface Props {
  filtros: FiltrosAtividade
  mostrarUsuario?: boolean
  vazio?: string
}

// Feed paginado por cursor: "proximo" é o id da última linha e volta como antes_de.
const FeedAtividade: React.FC<Props> = ({ filtros, mostrarUsuario = true, vazio = 'Nada por aqui ainda.' }) => {
  const [itens, setItens] = useState<LinhaAtividade[]>([])
  const [proximo, setProximo] = useState<string | number | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(false)
  const chave = JSON.stringify(filtros)
  const requisicao = useRef(0)

  const carregar = useCallback(
    async (cursor?: string | number | null) => {
      const id = ++requisicao.current
      setCarregando(true)
      setErro(false)
      try {
        const pagina = await getAtividade({ ...JSON.parse(chave), ...(cursor != null ? { antes_de: String(cursor) } : {}) })
        if (id !== requisicao.current) return
        setItens((atual) => (cursor != null ? [...atual, ...pagina.itens] : pagina.itens))
        setProximo(pagina.proximo)
      } catch {
        if (id === requisicao.current) setErro(true)
      } finally {
        if (id === requisicao.current) setCarregando(false)
      }
    },
    [chave],
  )

  useEffect(() => {
    setItens([])
    setProximo(null)
    carregar()
  }, [carregar])

  return (
    <div className="space-y-2">
      {itens.length > 0 && (
        <ul className="space-y-2">
          {itens.map((i) => (
            <Linha key={i.id} item={i} mostrarUsuario={mostrarUsuario} />
          ))}
        </ul>
      )}
      {carregando && <p className="text-sm text-on-surface-variant py-4 text-center">Carregando…</p>}
      {erro && (
        <div className="text-sm text-error py-4 text-center">
          Não foi possível carregar.{' '}
          <button className="underline" onClick={() => carregar(itens.length > 0 ? proximo : null)}>
            Tentar de novo
          </button>
        </div>
      )}
      {!carregando && !erro && itens.length === 0 && (
        <p className="text-sm text-on-surface-variant py-6 text-center">{vazio}</p>
      )}
      {!carregando && !erro && proximo != null && (
        <button
          onClick={() => carregar(proximo)}
          className="w-full min-h-[44px] rounded-xl bg-surface-container text-sm font-medium text-on-surface-variant hover:text-on-surface"
        >
          Carregar mais
        </button>
      )}
    </div>
  )
}

export default FeedAtividade
