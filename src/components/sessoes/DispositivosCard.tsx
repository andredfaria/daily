import React, { useCallback, useEffect, useState } from 'react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { sessionsApi, Sessao } from '../../api/auth'
import { useToast } from '../../context/ToastContext'
import { descreverDispositivo } from '../../utils/dispositivo'

// Sessões abertas: cada aparelho fica logado por 90 dias sem uso. Daqui dá para
// derrubar um aparelho perdido sem esperar o prazo.
const DispositivosCard: React.FC = () => {
  const { showToast } = useToast()
  const [sessoes, setSessoes] = useState<Sessao[] | null>(null)
  const [encerrando, setEncerrando] = useState<string | null>(null)

  const carregar = useCallback(() => {
    sessionsApi
      .list()
      .then((res) => setSessoes(res.data))
      .catch(() => setSessoes([]))
  }, [])

  useEffect(carregar, [carregar])

  const encerrar = async (id: string) => {
    setEncerrando(id)
    try {
      await sessionsApi.revoke(id)
      setSessoes((prev) => prev?.filter((s) => s.id !== id) ?? null)
      showToast('Dispositivo desconectado', 'success')
    } catch {
      showToast('Não foi possível desconectar', 'error')
    } finally {
      setEncerrando(null)
    }
  }

  const encerrarOutros = async () => {
    setEncerrando('outros')
    try {
      await sessionsApi.revokeOthers()
      setSessoes((prev) => prev?.filter((s) => s.current) ?? null)
      showToast('Outros dispositivos desconectados', 'success')
    } catch {
      showToast('Não foi possível desconectar', 'error')
    } finally {
      setEncerrando(null)
    }
  }

  const outros = sessoes?.filter((s) => !s.current).length ?? 0

  return (
    <div className="section-card">
      <div className="flex items-center gap-2 mb-2">
        <span className="material-symbols-outlined text-primary">devices</span>
        <h3 className="text-base font-semibold text-on-surface">Dispositivos conectados</h3>
      </div>
      <p className="text-xs text-on-surface-variant mb-4 leading-relaxed">
        Cada dispositivo continua conectado enquanto for usado. Depois de 90 dias sem uso, pede o código de novo.
      </p>

      {sessoes === null ? (
        <div className="h-12 rounded-xl bg-surface-container animate-pulse" />
      ) : (
        <ul className="divide-y divide-outline-variant/30">
          {sessoes.map((s) => {
            const { nome, icone } = descreverDispositivo(s.user_agent)
            return (
              <li key={s.id} className="flex items-center gap-3 py-2.5">
                <span className="material-symbols-outlined text-on-surface-variant">{icone}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-on-surface truncate">{nome}</p>
                  <p className="text-xs text-on-surface-variant">
                    {s.current
                      ? 'Este dispositivo'
                      : `Usado há ${formatDistanceToNow(parseISO(s.last_used_at), { locale: ptBR })}`}
                  </p>
                </div>
                {!s.current && (
                  <button
                    onClick={() => encerrar(s.id)}
                    disabled={encerrando !== null}
                    className="shrink-0 min-h-[44px] px-3 rounded-xl text-sm font-medium text-error hover:bg-error/10 transition-colors disabled:opacity-50"
                  >
                    {encerrando === s.id ? 'Saindo...' : 'Desconectar'}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {outros > 1 && (
        <button
          onClick={encerrarOutros}
          disabled={encerrando !== null}
          className="btn-ghost w-full justify-center mt-3"
        >
          <span className="material-symbols-outlined text-lg">logout</span>
          {encerrando === 'outros' ? 'Desconectando...' : 'Desconectar todos os outros'}
        </button>
      )}
    </div>
  )
}

export default DispositivosCard
