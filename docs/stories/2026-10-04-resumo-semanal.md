# Resumo semanal com constância por item e gastos

## Objetivo

Mostrar no resumo semanal do WhatsApp a frequência de cada item dos checklists e os gastos avulsos registrados no período.

## Checklist

- [x] Agregar os itens marcados individualmente por checklist, contando somente dias com poll enviado.
- [x] Incluir itens atuais não marcados e apresentar sua frequência como `0/N dias`.
- [x] Somar os gastos avulsos e informar quantidade de lançamentos no mesmo período semanal.
- [x] Atualizar o serviço e o formatador do resumo semanal.
- [x] Atualizar a lista de arquivos e tarefas concluídas neste registro.
- [ ] Validar manualmente a mensagem recebida em um ambiente conectado ao WhatsApp.

## Arquivos

- `backend/src/services/whatsappCommands.ts` — formata frequências individuais e gastos.
- `backend/src/services/summaryService.ts` — consulta itens, votos e despesas da semana.
- `TODO.md` — registra a entrega.
- `docs/stories/2026-10-04-resumo-semanal.md` — esta story.

## Período

São considerados os sete dias completos anteriores ao envio. O dia do envio não entra porque o checklist ainda pode receber votos.
