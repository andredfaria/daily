/**
 * Comandos do WhatsApp mostrados no app (Configurações e Como usar).
 * Espelha a ajuda de backend/src/services/whatsappCommands.ts — ao criar ou
 * mudar um comando lá, atualizar aqui.
 */
export interface ComandoWhatsapp {
  comando: string
  descricao: string
  /** Exemplo do que a pessoa digita. */
  exemplo: string
  /** Resposta típica, para a pessoa saber o que esperar. */
  resposta: string
}

export const COMANDOS_WHATSAPP: ComandoWhatsapp[] = [
  {
    comando: '/contas',
    descricao: 'O que vence nos próximos 7 dias',
    exemplo: '/contas',
    resposta: '📋 Contas dos próximos 7 dias\n\n• Luz — R$ 120,00 (amanhã)\n• Internet — R$ 99,90 (08/10)\n\nTotal: R$ 219,90',
  },
  {
    comando: '/hoje',
    descricao: 'Itens do checklist ainda não marcados',
    exemplo: '/hoje',
    resposta: '📝 Checklist de hoje\n\nManhã (1/3)\n◻️ Academia\n◻️ Ler',
  },
  {
    comando: '/marcar',
    descricao: 'Marca um item do checklist de hoje',
    exemplo: '/marcar academia',
    resposta: '✅ Academia marcado em Manhã (2/3)',
  },
  {
    comando: '/gasto',
    descricao: 'Anota um gasto do dia (aparece em Contas › Gastos)',
    exemplo: '/gasto 45 mercado',
    resposta: '💸 Anotado: mercado — R$ 45,00\n\nGastos do mês: R$ 312,40',
  },
  {
    comando: '/carteira',
    descricao: 'Patrimônio e variação do dia',
    exemplo: '/carteira',
    resposta: '💼 Carteira\n\nPatrimônio: R$ 25.430,00\nVariação desde ontem: +R$ 180,20 (+0,71%)',
  },
  {
    comando: '/ajuda',
    descricao: 'Lista de comandos',
    exemplo: '/ajuda',
    resposta: '🤖 Comandos do Rotina\n\n/contas — o que vence nos próximos 7 dias\n…',
  },
]
