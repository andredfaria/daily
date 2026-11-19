import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUsuariosAdmin } from '../../api/admin'
import { tempoRelativo } from '../../utils/atividade'
import type { UsuarioAdmin } from '../../types'

export const SeloVoce: React.FC = () => (
  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/15 text-primary">você</span>
)

const SeloFalhas: React.FC<{ n: number }> = ({ n }) =>
  n > 0 ? (
    <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-error/15 text-error">
      {n} {n === 1 ? 'falha' : 'falhas'}
    </span>
  ) : null

const AdminUsuarios: React.FC = () => {
  const navigate = useNavigate()
  const [lista, setLista] = useState<UsuarioAdmin[] | null>(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    getUsuariosAdmin()
      .then((l) =>
        setLista(
          [...l].sort((a, b) => (b.ultimo_acesso ? Date.parse(b.ultimo_acesso) : 0) - (a.ultimo_acesso ? Date.parse(a.ultimo_acesso) : 0)),
        ),
      )
      .catch(() => setErro(true))
  }, [])

  if (erro) return <p className="text-sm text-error text-center py-8">Não foi possível carregar os usuários.</p>
  if (!lista) return <p className="text-sm text-on-surface-variant text-center py-8">Carregando…</p>
  if (lista.length === 0) return <p className="text-sm text-on-surface-variant text-center py-8">Nenhum usuário.</p>

  const abrir = (id: string) => navigate(`/admin/usuarios/${id}`)

  return (
    <>
      {/* Celular: cartões */}
      <ul className="space-y-2 md:hidden">
        {lista.map((u) => (
          <li key={u.id}>
            <button
              onClick={() => abrir(u.id)}
              className="w-full text-left rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3 space-y-1"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-on-surface">{u.name ?? 'Sem nome'}</span>
                {!!u.is_admin && <SeloVoce />}
                <SeloFalhas n={u.falhas_30d} />
              </div>
              <div className="text-xs text-on-surface-variant">{u.whatsapp_number}</div>
              <div className="text-xs text-on-surface-variant">
                {u.ultimo_acesso ? tempoRelativo(u.ultimo_acesso) : 'nunca acessou'} · {u.comandos_30d} comandos · {u.mensagens_30d} mensagens (30d)
              </div>
            </button>
          </li>
        ))}
      </ul>

      {/* Desktop: tabela */}
      <div className="hidden md:block rounded-xl border border-outline-variant/40 bg-surface-container-lowest overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-on-surface-variant bg-surface-container">
            <tr>
              <th className="p-3 font-medium">Nome</th>
              <th className="p-3 font-medium">Número</th>
              <th className="p-3 font-medium">Último acesso</th>
              <th className="p-3 font-medium text-right">Comandos 30d</th>
              <th className="p-3 font-medium text-right">Mensagens 30d</th>
              <th className="p-3 font-medium">Falhas</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((u) => (
              <tr key={u.id} onClick={() => abrir(u.id)} className="border-t border-outline-variant/30 cursor-pointer hover:bg-surface-container/50">
                <td className="p-3 text-on-surface">
                  <span className="mr-2">{u.name ?? 'Sem nome'}</span>
                  {!!u.is_admin && <SeloVoce />}
                </td>
                <td className="p-3 text-on-surface-variant">{u.whatsapp_number}</td>
                <td className="p-3 text-on-surface-variant">{u.ultimo_acesso ? tempoRelativo(u.ultimo_acesso) : 'nunca'}</td>
                <td className="p-3 text-right tabular-nums">{u.comandos_30d}</td>
                <td className="p-3 text-right tabular-nums">{u.mensagens_30d}</td>
                <td className="p-3"><SeloFalhas n={u.falhas_30d} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

export default AdminUsuarios
