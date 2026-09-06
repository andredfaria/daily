import React from 'react'
import type { ComparativoConstancia, ConstanciaChecklist } from '../../../types'
import { formatarDelta } from '../../../utils/constancia'

interface ConstanciaCardProps {
  constancia: ConstanciaChecklist
}

const CORES_DIRECAO: Record<'subiu' | 'desceu' | 'igual', string> = {
  subiu: 'text-tertiary',
  desceu: 'text-error',
  igual: 'text-on-surface-variant',
}

const SETAS_DIRECAO: Record<'subiu' | 'desceu' | 'igual', string> = {
  subiu: '↗',
  desceu: '↘',
  igual: '→',
}

// Cor nunca é o único sinal do delta: a seta muda junto, mesma regra do selo
// de número em WhatsAppProfileCard.
const Delta: React.FC<{ atual: number; anterior: number }> = ({ atual, anterior }) => {
  const { texto, direcao } = formatarDelta(atual, anterior)
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium tabular-nums ${CORES_DIRECAO[direcao]}`}>
      <span aria-hidden="true">{SETAS_DIRECAO[direcao]}</span>
      {texto}
    </span>
  )
}

const LinhaMetrica: React.FC<{
  label: string
  valor: number
  denominador: number
  anterior: number
}> = ({ label, valor, denominador, anterior }) => (
  <div className="flex items-center justify-between gap-3 text-sm">
    <span className="text-on-surface-variant">{label}</span>
    <span className="flex items-center gap-2">
      <span className="text-on-surface font-medium tabular-nums">{valor} de {denominador}</span>
      <Delta atual={valor} anterior={anterior} />
    </span>
  </div>
)

// `semana` e `mes` vêm de computeConsistency (backend) calculadas de forma
// independente sobre a mesma lista de polls — não há regra ligando as duas.
// Um checklist pausado esta semana mas com polls entre 8 e 30 dias atrás tem
// semana.atual.dias_com_poll === 0 e mes.atual.dias_com_poll > 0, então o
// vazio é decidido por bloco, nunca por um flag único que descartaria dado
// mensal real.
const JanelaBloco: React.FC<{ titulo: string; comparativo: ComparativoConstancia }> = ({ titulo, comparativo }) => {
  const semDados = comparativo.atual.dias_com_poll === 0
  return (
    <div>
      <p className="text-xs font-medium text-on-surface-variant mb-2">{titulo}</p>
      {semDados ? (
        <p className="text-sm text-on-surface-variant">Sem poll enviado nesse período.</p>
      ) : (
        <div className="space-y-2">
          <LinhaMetrica
            label="respondeu"
            valor={comparativo.atual.dias_respondidos}
            denominador={comparativo.atual.dias_com_poll}
            anterior={comparativo.anterior.dias_respondidos}
          />
          <LinhaMetrica
            label="completou"
            valor={comparativo.atual.dias_completos}
            denominador={comparativo.atual.dias_com_poll}
            anterior={comparativo.anterior.dias_completos}
          />
        </div>
      )}
    </div>
  )
}

export const ConstanciaCard: React.FC<ConstanciaCardProps> = ({ constancia }) => {
  // Vazio de verdade só quando as duas janelas não têm poll nenhum — se só
  // uma estiver zerada, o bloco dela mesma mostra a mensagem (ver
  // JanelaBloco), preservando o dado real da outra janela.
  const semHistoricoTotal =
    constancia.semana.atual.dias_com_poll === 0 && constancia.mes.atual.dias_com_poll === 0

  return (
    <section className="glass-card rounded-2xl border border-outline-variant/50 p-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <h3 className="text-base font-semibold text-on-surface">Constância</h3>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="material-symbols-outlined text-orange-400 text-lg" aria-hidden="true">local_fire_department</span>
          <div className="leading-tight text-right">
            <p className="text-sm font-semibold text-on-surface">
              {constancia.sequencia.atual} {constancia.sequencia.atual === 1 ? 'dia seguido' : 'dias seguidos'}
            </p>
            <p className="text-xs text-on-surface-variant">recorde: {constancia.sequencia.melhor}</p>
          </div>
        </div>
      </div>

      {semHistoricoTotal ? (
        <p className="text-sm text-on-surface-variant">Ainda não há poll enviado.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <JanelaBloco titulo="últimos 7 dias" comparativo={constancia.semana} />
          <JanelaBloco titulo="últimos 30 dias" comparativo={constancia.mes} />
        </div>
      )}
    </section>
  )
}
