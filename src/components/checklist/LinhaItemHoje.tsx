import React from 'react'
import type { ChecklistItemStat } from '../../types'
import { classificarItem, STREAK_MINIMO_EXIBIDO, type ClassificacaoItem } from '../../utils/checklistItem'

// Item bom não ganha selo: poluir toda linha para elogiar as boas tira a
// atenção das duas que precisam de conserto.
const ROTULO: Partial<Record<ClassificacaoItem, string>> = {
  fraco: 'fraco',
  oscilando: 'oscilando',
}

interface LinhaItemHojeProps {
  texto: string
  marcado: boolean
  stat?: ChecklistItemStat
}

/**
 * Uma linha do "Progresso de Hoje". Existe para o usuário ver o que ficou para
 * trás — a tela antiga listava só os itens marcados, então o que faltava era
 * invisível — e, ao lado, como ele costuma ir naquele item nos últimos 30 dias.
 */
export const LinhaItemHoje: React.FC<LinhaItemHojeProps> = ({ texto, marcado, stat }) => {
  const classificacao = stat ? classificarItem(stat.pct, stat.total_polls) : 'sem_dados'
  const rotulo = ROTULO[classificacao]
  const mostrarStreak = (stat?.streak_current ?? 0) >= STREAK_MINIMO_EXIBIDO

  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span
          className={`material-symbols-outlined text-base flex-shrink-0 ${
            marcado ? 'text-tertiary' : 'text-on-surface-variant/60'
          }`}
          style={marcado ? { fontVariationSettings: "'FILL' 1" } : undefined}
          aria-hidden="true"
        >
          {marcado ? 'check_circle' : 'radio_button_unchecked'}
        </span>
        <span
          className={`text-sm truncate ${marcado ? 'text-on-surface' : 'text-on-surface-variant'}`}
          title={texto}
        >
          {texto}
        </span>
        {/* O ícone é decorativo; o estado chega ao leitor de tela por aqui. */}
        <span className="sr-only">{marcado ? '— marcado hoje' : '— não marcado hoje'}</span>
      </div>

      <div className="flex items-center gap-2 pl-6 sm:pl-0 flex-shrink-0 text-[11px] text-on-surface-variant">
        {classificacao === 'sem_dados' || !stat ? (
          <span className="italic">sem dados ainda</span>
        ) : (
          <>
            {rotulo && (
              // Cor nunca é o único sinal: a palavra já diz o que está ruim.
              <span className={classificacao === 'fraco' ? 'text-error' : undefined}>{rotulo}</span>
            )}
            <span className="tabular-nums" title={`${stat.marked_count} de ${stat.total_polls} dias`}>
              {stat.pct}%
            </span>
            {mostrarStreak && (
              <span className="flex items-center gap-0.5">
                <span
                  className="material-symbols-outlined text-orange-400 text-xs"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                  aria-hidden="true"
                >
                  local_fire_department
                </span>
                <span className="tabular-nums">{stat.streak_current}</span>
                <span className="sr-only">dias seguidos</span>
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}
