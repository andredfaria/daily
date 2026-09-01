import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { assetsApi } from '../../api/assets'
import type { AssetHistoryPoint, AssetWithQuote } from '../../types'
import { agregarPosicao, alocacaoPorTipo, resultadoPorAtivo } from '../../utils/assetAnalytics'
import { StatCard } from '../../components/ui/StatCard'
import { AlocacaoPorTipo } from '../../components/ativos/analise/AlocacaoPorTipo'
import { ResultadoPorAtivo } from '../../components/ativos/analise/ResultadoPorAtivo'
import { EvolucaoPatrimonio } from '../../components/ativos/analise/EvolucaoPatrimonio'
import { ReguaAlvoStop } from '../../components/ativos/analise/ReguaAlvoStop'
import { formatBRL, formatDate } from '../../utils/format'

const AtivosAnalise: React.FC = () => {
  const navigate = useNavigate()
  const [ativos, setAtivos] = useState<AssetWithQuote[]>([])
  const [pontos, setPontos] = useState<AssetHistoryPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(false)
    const [listaR, histR] = await Promise.allSettled([assetsApi.list(), assetsApi.history(90)])
    if (listaR.status === 'fulfilled') setAtivos(listaR.value)
    if (histR.status === 'fulfilled') setPontos(histR.value.pontos)
    setErro(listaR.status === 'rejected')
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="material-symbols-outlined text-primary text-4xl animate-spin">progress_activity</span>
      </div>
    )
  }

  if (erro) {
    return (
      <div className="glass-card rounded-2xl border border-error/30 p-4 flex items-center gap-3">
        <span className="material-symbols-outlined text-error">error</span>
        <p className="text-sm text-on-surface flex-1">Erro ao carregar a carteira.</p>
        <button onClick={carregar} className="btn-ghost text-xs min-h-[44px]">Tentar de novo</button>
      </div>
    )
  }

  if (ativos.length === 0) {
    return (
      <div className="glass-card rounded-2xl border border-outline-variant/50 p-12 text-center">
        <span className="material-symbols-outlined text-4xl text-on-surface-variant mb-3 block">trending_up</span>
        <p className="text-on-surface font-semibold mb-1">Carteira vazia</p>
        <p className="text-sm text-on-surface-variant mb-4">Cadastre um ativo para ver a análise aqui.</p>
        <button onClick={() => navigate('/ativos/carteira')} className="btn-primary mx-auto">
          <span className="material-symbols-outlined text-lg">add</span>
          Adicionar Ativo
        </button>
      </div>
    )
  }

  const posicao = agregarPosicao(ativos)
  const positivo = posicao.resultado >= 0
  const desatualizados = ativos.filter((a) => a.quote_stale && a.last_quote_at !== null)

  return (
    <div className="space-y-6">
      {desatualizados.length > 0 && (
        <div className="glass-card rounded-2xl border border-outline-variant/50 p-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-yellow-400 text-lg">schedule</span>
          <p className="text-xs text-on-surface-variant">
            {desatualizados.length === 1 ? 'Uma cotação é' : `${desatualizados.length} cotações são`} de{' '}
            {formatDate(desatualizados[0].last_quote_at!)} — mercado fechado.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon="account_balance_wallet"
          label="Patrimônio"
          value={`R$ ${formatBRL(posicao.patrimonio)}`}
          iconColor="text-primary"
          iconBg="bg-primary/15"
        />
        <StatCard
          icon="payments"
          label="Investido"
          value={`R$ ${formatBRL(posicao.investido)}`}
          iconColor="text-on-surface-variant"
          iconBg="bg-surface-container-high"
        />
        <StatCard
          icon={positivo ? 'trending_up' : 'trending_down'}
          label="Resultado"
          value={`${positivo ? '+' : '−'}R$ ${formatBRL(Math.abs(posicao.resultado))}`}
          sub={`${positivo ? '+' : '−'}${Math.abs(posicao.resultadoPct).toFixed(1)}%`}
          iconColor={positivo ? 'text-tertiary' : 'text-error'}
          iconBg={positivo ? 'bg-tertiary/15' : 'bg-error/15'}
        />
        <StatCard
          icon="inventory_2"
          label="Ativos"
          value={posicao.comPosicao}
          sub={[
            posicao.watchlist > 0 ? `${posicao.watchlist} em observação` : null,
            posicao.semCotacao > 0 ? `${posicao.semCotacao} sem cotação` : null,
          ].filter(Boolean).join(' · ') || undefined}
          iconColor="text-primary"
          iconBg="bg-primary/15"
        />
      </div>

      <EvolucaoPatrimonio pontos={pontos} desde={pontos.length > 0 ? pontos[0].date : null} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AlocacaoPorTipo fatias={alocacaoPorTipo(ativos)} />
        <ResultadoPorAtivo resultados={resultadoPorAtivo(ativos)} />
      </div>

      <ReguaAlvoStop ativos={ativos} />
    </div>
  )
}

export default AtivosAnalise
