# Organizar a Home como visão geral financeira

## Objetivo

Dar prioridade às informações mais importantes na Home, incluindo patrimônio, resultado da carteira, gastos do mês e ativos em destaque, mantendo os atalhos para rotina e vencimentos.

## Checklist

- [x] Criar hierarquia visual clara para a visão geral.
- [x] Exibir patrimônio atual e posições com os dados já fornecidos pela API de ativos.
- [x] Destacar o resultado da carteira sem ocultar posições sem cotação.
- [x] Mostrar gastos do mês como indicador de acesso rápido.
- [x] Incluir estados de carregamento e carteira vazia.
- [x] Reorganizar o painel em grade compacta com conexão WhatsApp, maiores altas e baixas, gastos recentes, checklist e próximos vencimentos.
- [x] Limitar os destaques a três posições por variação, três gastos recentes e três vencimentos visíveis, mantendo a quantidade de vencimentos do período.
- [x] Validar build e testes automatizados disponíveis.
- [ ] Inspecionar visualmente no navegador.

## Arquivos

- `src/pages/Home.tsx` — indicadores principais e resumo da carteira na Home.
- `src/pages/Home.tsx` — grade compacta com altas/baixas da carteira, gastos recentes, perfil conectado e vencimentos.
- `docs/stories/2026-10-04-home-visao-geral-carteira.md` — esta story.

## Regras de dados

- Patrimônio soma posições com quantidade maior que zero e cotação disponível, seguindo `totalCarteira`.
- Resultado soma `profit_loss` das posições e mantém valores sem cotação fora do cálculo.
- A lista em destaque mostra no máximo quatro ativos, ordenados pelo valor atual conhecido.

## Validação automatizada

- `npm run build` — passou (`tsc` e Vite).
- `npm test -- --run` — passou (9 arquivos, 83 testes).
- `npm run lint` e `npm run typecheck` — scripts não existem no `package.json`; a checagem de tipos está incluída no build.
