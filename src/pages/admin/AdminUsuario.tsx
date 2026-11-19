import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getUsuarioAdmin } from '../../api/admin'
import FeedAtividade from '../../components/admin/FeedAtividade'
import { SeloVoce } from './AdminUsuarios'
import { tempoRelativo } from '../../utils/atividade'
import type { UsuarioAdminDetalhe } from '../../types'

const TIPOS: { valor: string; rotulo: string }[] = [
  { valor: '', rotulo: 'Tudo' },
  { valor: 'login,login_falha,otp_pedido,logout,acesso', rotulo: 'Acesso' },
  { valor: 'msg_enviada', rotulo: 'Mensagens' },
  { valor: 'comando', rotulo: 'Comandos' },
  { valor: 'erro_api,erro_tick', rotulo: 'Erros' },
]

const Dado: React.FC<{ rotulo: string; valor: React.ReactNode }> = ({ rotulo, valor }) => (
  <div className="rounded-xl bg-surface-container-lowest border border-outline-variant/40 p-3">
    <div className="text-lg font-semibold text-on-surface">{valor}</div>
    <div className="text-xs text-on-surface-variant">{rotulo}</div>
  </div>
)

const AdminUsuario: React.FC = () => {
  const { id = '' } = useParams()
  const [u, setU] = useState<UsuarioAdminDetalhe | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [tipo, setTipo] = useState('')

  useEffect(() => {
    setU(null)
    setErro(null)
    getUsuarioAdmin(id)
      .then(setU)
      .catch((e) => setErro(e?.response?.status === 404 ? 'Usuário não encontrado.' : 'Não foi possível carregar o usuário.'))
  }, [id])

  const voltar = (
    <Link to="/admin/usuarios" className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface min-h-[44px]">
      <span className="material-symbols-outlined text-[18px]">arrow_back</span>Usuários
    </Link>
  )

  if (erro) return <div>{voltar}<p className="text-sm text-error text-center py-8">{erro}</p></div>
  if (!u) return <div>{voltar}<p className="text-sm text-on-surface-variant text-center py-8">Carregando…</p></div>

  return (
    <div className="space-y-5">
      {voltar}
      <div>
        <h1 className="text-lg font-semibold text-on-surface flex items-center gap-2">
          {u.name ?? 'Sem nome'} {!!u.is_admin && <SeloVoce />}
        </h1>
        <p className="text-sm text-on-surface-variant">{u.whatsapp_number}</p>
        <p className="text-xs text-on-surface-variant mt-1">
          Último acesso: {u.ultimo_acesso ? tempoRelativo(u.ultimo_acesso) : 'nunca'} · aviso às {u.notification_time}h ·
          WhatsApp {u.whatsapp_alerts_enabled ? 'ligado' : 'desligado'}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Dado rotulo="Sessões ativas" valor={u.sessoes_ativas} />
        <Dado rotulo="Logins (30d)" valor={u.logins_30d} />
        <Dado rotulo="Comandos (30d)" valor={u.comandos_30d} />
        <Dado rotulo="Mensagens (30d)" valor={u.mensagens_30d} />
        <Dado rotulo="Falhas (30d)" valor={u.falhas_30d} />
        <Dado rotulo="Contas ativas" valor={u.contas_ativas} />
        <Dado rotulo="Gastos no mês" valor={u.gastos_mes} />
        <Dado rotulo="Ativos / checklists" valor={`${u.ativos} / ${u.checklists}`} />
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-on-surface">Sessões</h2>
        {u.sessoes.length === 0 ? (
          <p className="text-sm text-on-surface-variant">Nenhuma sessão ativa.</p>
        ) : (
          <ul className="space-y-2">
            {u.sessoes.map((s) => (
              <li key={s.id} className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3 text-sm">
                <div className="text-on-surface break-words">{s.user_agent ?? 'Dispositivo desconhecido'}</div>
                <div className="text-xs text-on-surface-variant">usada {tempoRelativo(s.last_used_at)} · criada {tempoRelativo(s.created_at)}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-on-surface">Linha do tempo</h2>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {TIPOS.map((t) => (
            <button
              key={t.rotulo}
              onClick={() => setTipo(t.valor)}
              className={`flex-shrink-0 min-h-[44px] px-4 rounded-full text-sm font-medium ${
                tipo === t.valor ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
              }`}
            >
              {t.rotulo}
            </button>
          ))}
        </div>
        <FeedAtividade filtros={{ user_id: u.id, ...(tipo ? { kind: tipo } : {}) }} mostrarUsuario={false} />
      </section>
    </div>
  )
}

export default AdminUsuario
