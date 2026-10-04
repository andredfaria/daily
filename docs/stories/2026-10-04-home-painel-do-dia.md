# Completar a Home como painel do dia

## Objetivo

Completar a Home com o acompanhamento de gastos do mês contra o limite mensal e permitir marcar itens do checklist de hoje sem sair da página.

## Checklist

- [x] Mostrar total gasto no mês corrente de São Paulo.
- [x] Comparar o total ao limite mensal de gastos e oferecer atalho às configurações se não houver limite.
- [x] Exibir o checklist mais recente, progresso e ação para marcar itens ainda pendentes.
- [x] Permitir enviar o checklist para o WhatsApp quando ainda não houver poll de hoje.
- [x] Persistir marcações do app em `command_marked` para preservar os itens quando chegar um voto posterior do WhatsApp.
- [x] Validar build do frontend/backend e suítes automatizadas disponíveis.
- [ ] Validar manualmente no navegador conectado ao backend e WAHA.

## Arquivos

- `src/pages/Home.tsx` — resumo mensal de gastos e painel acionável do checklist.
- `src/api/checklists.ts` — chamada para marcar item de hoje.
- `backend/src/routes/checklists.ts` — endpoint autenticado para marcar item do poll do próprio usuário.
- `docs/stories/2026-10-04-home-painel-do-dia.md` — esta story.

## Regras de período e acesso

- Os gastos consideram o mês atual em `America/Sao_Paulo` e usam o mesmo limite mensal configurado para gastos.
- A marcação só aceita item pertencente ao checklist do usuário e poll enviado para hoje em `America/Sao_Paulo`.
- A marcação é idempotente; já marcado permanece marcado.

## Validação automatizada

- Frontend: `npm run build` e `npm test -- --run` (9 arquivos, 83 testes).
- Backend: `npm run build --prefix backend` e `npm test --prefix backend -- --runInBand` (17 suítes, 329 testes).
