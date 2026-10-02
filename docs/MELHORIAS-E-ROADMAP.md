# Rotina — Melhorias e Futuras Features

Atualizado em 2026-10-02.

O Rotina já cobre quatro domínios (contas, gastos avulsos, carteira de ativos e checklists) e usa o WhatsApp como canal principal. A próxima fase deve priorizar **confiabilidade e testes** antes de abrir novos domínios: hoje um tick perdido do scheduler ou uma rota quebrada só aparece quando o usuário reclama.

## 1. Estado atual

| Domínio | O que já existe |
| --- | --- |
| Contas | Recorrência mensal/semanal/única, lembretes, orçamento, fechamento mensal, exportação CSV do histórico |
| Gastos | `/gasto` pelo WhatsApp, edição na linha, 8 categorias padrão + personalizadas, inferência por palavra-chave |
| Ativos | Ações, FIIs e cripto (brapi + CoinGecko), alertas de alvo/stop, snapshot diário, comparativo com CDI e IBOV |
| Checklists | Enquete diária, `/marcar`, recorrência por dia da semana, análise de consistência e heatmap |
| Plataforma | Login por OTP, comandos `/contas` `/carteira` `/hoje` `/ajuda`, resumo semanal e mensal, trava `message_claims` contra envio duplicado |

Testes: 15 arquivos no backend e 7 no frontend, todos de funções puras. Rotas, scheduler, migrations e handlers de webhook não têm cobertura.

## 2. Melhorias técnicas

### 2.1 Confiabilidade

- **Tick perdido do scheduler.** Há um único `cron.schedule('0 * * * *')` (`backend/src/scheduler.ts:42`). Se o container reinicia às 10h00m30s, o tick das 10h some e quem tem lembrete às 10h fica sem ele. Proposta: gravar `last_tick_hour` numa tabela e, no boot, rodar o tick da hora corrente se ainda não rodou (a trava `message_claims` já impede duplicidade).
- **Tick sequencial por usuário.** Os usuários são processados um a um dentro do tick. Com dezenas de usuários e WAHA lento (timeout de 10s), o tick pode passar da hora. Proposta: concorrência limitada (ex.: 3 por vez) e log da duração total do tick.
- **Fila de reenvio para falhas certas.** Hoje falha ambígua perde o envio do dia (decisão consciente). Falhas *certas* (`ECONNREFUSED`, 4xx) liberam a trava, mas ninguém tenta de novo até o dia seguinte. Proposta: reagendar uma tentativa no próximo tick.
- **Monitor de sessão do WAHA.** Se a sessão do WhatsApp cai, todos os envios falham em silêncio. Proposta: checar o status da sessão no tick e avisar no app (banner em Configurações) e por e-mail ou outro canal.

### 2.2 Segurança

- **Vazamento de mensagem de erro.** O handler de 500 (`backend/src/index.ts`) devolve `err.message` ao cliente, e o `/api/health` devolve o erro do banco. Em produção, responder mensagem genérica e manter o detalhe só no log.
- **Rate limit global.** Só o webhook usa `express-rate-limit`. O OTP já limita tentativas por código, mas as rotas autenticadas não têm teto. Proposta: limite por usuário nas rotas que chamam provedores externos (cotação, perfil do WhatsApp).
- **Validação de entrada.** As rotas validam campos à mão. Proposta: adotar `zod` nos corpos de POST/PATCH, começando por `bills`, `expenses` e `assets`.
- **Revogação de sessão.** O JWT vale 30 dias e não há como derrubá-lo. Proposta: coluna `token_version` em `users`, incrementada em "sair de todos os dispositivos".

### 2.3 Testes e CI

- **Testes de rota com banco real.** Subir MySQL em container (Testcontainers ou `docker compose` de teste) e cobrir os fluxos que mais quebram: criação de conta recorrente, `/gasto`, `/marcar`, PATCH de ativo com troca de ticker.
- **Teste das migrations.** Rodar `runMigrations()` duas vezes num banco vazio e checar que é idempotente.
- **CI no GitHub Actions.** Hoje não há pipeline. Mínimo: `tsc` dos dois lados + `npm test` dos dois lados a cada push na master.

### 2.4 Observabilidade

- **Log estruturado.** Trocar `console.log` por `pino` com `user_id`, rota e duração; o log de toda requisição (`[req] GET /api/...`) vira nível `debug`.
- **Painel de saúde dos envios.** Uma tela admin (ou endpoint) com envios do dia por tipo, falhas e travas presas em `message_claims`.
- **Alerta de cota da brapi/CoinGecko.** Contar requisições por mês e avisar ao passar de 80% das 15.000 do plano gratuito.

### 2.5 Dívida técnica

- **`backend/src/pending-migrations/`** guarda SQL de 006 a 009, que já estão inline em `migrate.ts`. Apagar para não confundir.
- **Rotas grandes.** `routes/checklists.ts` (467 linhas) e `routes/assets.ts` (411) misturam SQL, regra e resposta. Extrair a regra para `services/`, como já foi feito com comandos do WhatsApp.
- **`pool.query` direto nas rotas** (103 chamadas). Uma camada fina de repositório por tabela facilitaria os testes de rota.
- **Dockerfile do backend** usa `npm install`; trocar por `npm ci` para build reprodutível.
- **`dist/index.html` versionado** aparece modificado a cada build; remover do índice do git (ele já está no `.gitignore`).

## 3. Melhorias de UX nas funcionalidades existentes

- **Home como painel do dia.** Mostrar numa tela só: contas que vencem hoje e amanhã, checklist de hoje com marcação direta e gasto do mês contra o orçamento.
- **Gastos:** filtro por categoria e mês, total por categoria no topo, e desfazer a exclusão por alguns segundos.
- **Contas:** marcar uma ocorrência como "paga" de forma opcional (sem voltar ao modelo antigo de status obrigatório), útil para quem quer conferir o mês.
- **Ativos:** gráfico de evolução do patrimônio a partir de `asset_snapshots`, e preço médio editável após aporte parcial.
- **Checklists:** sequência atual (streak) visível no card e meta semanal por item.
- **WhatsApp:** `/gasto` respondendo com o total da categoria no mês ("Mercado: R$ 612 de R$ 800"); `/desfazer` para apagar o último gasto lançado.
- **PWA:** manifest + service worker para instalar na tela inicial do celular e abrir offline em modo leitura.
- **Acessibilidade:** revisar contraste e foco de teclado contra `design-system/rotina/MASTER.md`.

## 4. Futuras features

### Finanças

- **Importação de extrato (OFX/CSV)** do banco, com categorização automática reaproveitando `inferirCategoria` e detecção de duplicidade contra gastos já lançados.
- **Metas de economia**: valor-alvo e data, com aporte mensal sugerido e progresso no resumo semanal.
- **Receitas**: registrar salário e entradas para mostrar saldo do mês, não só gasto.
- **Orçamento por categoria**, com alerta no WhatsApp ao passar de 80% e 100%.
- **Assinaturas detectadas**: contas mensais de valor parecido viram uma lista "assinaturas", com total anual.
- **Gasto por foto**: enviar a foto do cupom no WhatsApp e extrair valor e estabelecimento.

### Investimentos

- **Proventos**: registrar dividendos e JCP de ações e FIIs, com rentabilidade incluindo proventos.
- **Renda fixa**: CDB, Tesouro e LCI com rendimento atrelado ao CDI já buscado no Banco Central.
- **Rebalanceamento**: alocação-alvo por tipo e sugestão de aporte para voltar ao alvo.
- **Relatório de IR**: posição em 31/12 e operações do ano, exportável.

### Rotina e hábitos

- **Lembretes livres** pelo WhatsApp: `/lembrar amanhã 9h ligar pro dentista`.
- **Checklist com horário por item** e enquete separada para manhã e noite.
- **Diário rápido**: `/nota` grava um texto do dia, visível numa linha do tempo.

### Plataforma

- **Contas compartilhadas** (casal ou família): uma conta pertence a mais de um usuário e o lembrete vai para os dois.
- **Assistente em linguagem natural** no WhatsApp: "quanto gastei com mercado esse mês?" respondido a partir dos dados, usando a API do Claude com ferramentas que consultam o banco.
- **Exportação e backup** de todos os dados do usuário em JSON/CSV (também atende à LGPD).
- **Exclusão de conta** pelo app, apagando os dados de todas as tabelas.

## 5. Priorização

Impacto e esforço estimados de 1 a 3; a ordem favorece o que reduz risco antes do que adiciona tela.

| # | Item | Tipo | Impacto | Esforço |
| --- | --- | --- | --- | --- |
| 1 | CI com `tsc` + testes | Técnica | 3 | 1 |
| 2 | Recuperar tick perdido do scheduler | Técnica | 3 | 1 |
| 3 | Monitor de sessão do WAHA | Técnica | 3 | 2 |
| 4 | Esconder `err.message` em produção | Segurança | 2 | 1 |
| 5 | Limpeza da dívida (pending-migrations, `npm ci`, `dist/`) | Técnica | 1 | 1 |
| 6 | Orçamento por categoria + alerta | Feature | 3 | 2 |
| 7 | Home como painel do dia | UX | 3 | 2 |
| 8 | Testes de rota com MySQL | Técnica | 3 | 3 |
| 9 | Importação de extrato OFX/CSV | Feature | 3 | 3 |
| 10 | Proventos e renda fixa | Feature | 2 | 3 |
| 11 | Assistente em linguagem natural | Feature | 2 | 3 |
| 12 | Contas compartilhadas | Feature | 2 | 3 |

**Sugestão de ondas:**

1. **Fundação (1–2 semanas):** itens 1 a 5.
2. **Controle do mês:** itens 6 e 7, mais receitas e metas de economia.
3. **Base de testes e dados:** item 8, depois importação de extrato (9).
4. **Expansão:** investimentos (10), assistente (11) e compartilhamento (12).

## Perguntas em aberto

- Quantos usuários ativos o sistema tem hoje? Isso decide a urgência da concorrência no tick.
- Contas compartilhadas e exclusão de conta exigem rever o modelo `user_id` em todas as tabelas — vale planejar antes de crescer o schema.
