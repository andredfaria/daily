import React from 'react'
import { useSearchParams } from 'react-router-dom'
import FeedAtividade from '../../components/admin/FeedAtividade'

const TIPOS = [
  { valor: 'msg_enviada,comando', rotulo: 'Tudo' },
  { valor: 'msg_enviada', rotulo: 'Enviadas' },
  { valor: 'comando', rotulo: 'Comandos' },
]

const AdminMensagens: React.FC = () => {
  const [params, setParams] = useSearchParams()
  const soFalhas = params.get('falhas') === '1'
  const tipo = TIPOS.find((t) => t.valor === params.get('tipo'))?.valor ?? TIPOS[0].valor

  const mudar = (chave: string, valor: string | null) => {
    const novo = new URLSearchParams(params)
    if (valor) novo.set(chave, valor)
    else novo.delete(chave)
    setParams(novo, { replace: true })
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto no-scrollbar items-center">
        {TIPOS.map((t) => (
          <button
            key={t.valor}
            onClick={() => mudar('tipo', t.valor === TIPOS[0].valor ? null : t.valor)}
            className={`flex-shrink-0 min-h-[44px] px-4 rounded-full text-sm font-medium ${
              tipo === t.valor ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            {t.rotulo}
          </button>
        ))}
        <button
          role="switch"
          aria-checked={soFalhas}
          onClick={() => mudar('falhas', soFalhas ? null : '1')}
          className={`flex-shrink-0 min-h-[44px] px-4 rounded-full text-sm font-medium flex items-center gap-1.5 ${
            soFalhas ? 'bg-error text-on-error' : 'bg-surface-container text-on-surface-variant'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">error</span>Só falhas
        </button>
      </div>
      <FeedAtividade
        filtros={{ kind: tipo, ...(soFalhas ? { status: 'falha' as const } : {}) }}
        vazio={soFalhas ? 'Nenhuma falha de envio.' : 'Nenhuma mensagem ainda.'}
      />
    </div>
  )
}

export default AdminMensagens
