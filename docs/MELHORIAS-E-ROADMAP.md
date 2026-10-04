# Rotina — Melhorias e Futuras Features

Atualizado em 2026-10-04.

Esta revisão confere as propostas abaixo contra o código existente em 2026-10-04.
Use **Feito** para entrega completa, **Parcial** quando falta parte do escopo, e
**Pendente** quando não foi encontrado código correspondente. A etiqueta descreve
o estado observado; não altera prioridade nem cria requisito novo.

O Rotina já cobre quatro domínios (contas, gastos avulsos, carteira de ativos e checklists) e usa o WhatsApp como canal principal. A recuperação de tick perdido já foi implementada; a próxima fase deve priorizar os riscos restantes de confiabilidade, segurança e cobertura de testes antes de abrir novos domínios.

## 1. Estado atual

| Domínio | O que já existe |
| --- | --- |
| Contas | Recorrências, lembretes, limite mensal, fechamento mensal e exportação CSV do histórico. Ocorrências não têm estado de pagamento (removido na migration 010). |
| Gastos | `/gasto` pelo WhatsApp com confirmação do total mensal, edição, categorias padrão e personalizadas, inferência por palavra-chave, filtro por mês/categoria, totais por categoria e limite mensal próprio. |
| Ativos | Ações, FIIs e cripto (brapi + CoinGecko), alertas de alvo/stop, snapshots diários, evolução do patrimônio e comparativo com CDI/IBOV; preço médio editável. |
| Checklists | Enquete diária, `/marcar`, recorrência por dia da semana, histórico/heatmap, ranking de itens com streak e frequência individual no resumo semanal. Meta semanal por item ainda não existe. |
| Plataforma | OTP e sessões revogáveis por dispositivo, comandos `/contas` `/carteira` `/hoje` `/ajuda`, resumos semanal/mensal, trava `message_claims`; estado de conexão WAHA na Home. |

Testes: 17 arquivos no backend e 9 no frontend. A cobertura continua concentrada em serviços/utilitários e não inclui rotas HTTP com banco real, migrations contra MySQL nem fluxos integrados do scheduler/webhook. Não há workflow de CI em `.github/workflows/`.

## 2. Melhorias técnicas

### 2.1 Confiabilidade

- **[Feito] Tick perdido do scheduler.** `scheduler_ticks` reserva o tick de cada hora e `initScheduler()` recupera no boot o tick da hora corrente. A implementação está em `backend/src/scheduler.ts` e `services/schedulerTick.ts`.
- **[Pendente] Tick sequencial por usuário.** Contas e resumos ainda percorrem usuários em sequência; não há concorrência limitada nem medição de duração total do tick.
- **[Pendente] Fila de reenvio para falhas certas.** Falhas de notificação recebem estado `failed`; não há tentativa automática no próximo tick.
- **[Parcial] Monitor de sessão do WAHA.** O dispatcher verifica a sessão antes dos envios e a Home mostra o estado de conexão. Ainda não há alerta persistente em Configurações nem canal alternativo de aviso.

### 2.2 Segurança

- **[Pendente] Vazamento de mensagem de erro.** O handler 500 e `/api/health` ainda devolvem detalhes de erro ao cliente; manter mensagem genérica em produção segue pendente.
- **[Pendente] Rate limit global.** O limiter está aplicado ao webhook; as rotas autenticadas não têm limite geral por usuário.
- **[Pendente] Validação de entrada com schema.** Há validações manuais nas rotas; não foi encontrada adoção de Zod para `bills`, `expenses` e `assets`.
- **[Feito, com implementação diferente] Revogação de sessão.** O JWT legado foi substituído por sessões armazenadas no servidor. Há logout por dispositivo e revogação dos outros dispositivos em `backend/src/routes/auth.ts`; não usa `token_version`.

### 2.3 Testes e CI

- **[Pendente] Testes de rota com banco real.** Não há configuração de MySQL de teste nem cobertura dos fluxos de rota citados.
- **[Pendente] Teste das migrations.** Não foi encontrado teste de `runMigrations()` em banco vazio nem execução repetida para comprovar idempotência.
- **[Pendente] CI no GitHub Actions.** Não há workflow em `.github/workflows/` executando compilação/testes nos pushes.

### 2.4 Observabilidade

- **[Pendente] Log estruturado.** O backend ainda usa `console.*`; cada requisição continua gerando log `[req]` sem níveis/campos estruturados.
- **[Pendente] Painel de saúde dos envios.** A tela de notificações mostra histórico do usuário, mas não existe visão admin agregada por tipo/falha nem inspeção de claims presos.
- **[Pendente] Alerta de cota da brapi/CoinGecko.** Há cache e fallback de cota em cotação, mas não contador mensal nem alerta de uso.

### 2.5 Dívida técnica

- **[Pendente] `backend/src/pending-migrations/`.** Os SQL de 006 a 009 ainda estão na pasta, apesar de as migrações também estarem inline em `migrate.ts`.
- **[Pendente] Rotas grandes.** `routes/checklists.ts` (467 linhas) e `routes/assets.ts` (411) ainda concentram SQL, regra e resposta.
- **[Pendente] Consultas diretas nas rotas.** Foram encontradas 112 ocorrências de `pool.query` em `backend/src/routes`; não há camada fina de repositórios por tabela.
- **[Feito] Dockerfiles com instalação reprodutível.** Tanto `backend/Dockerfile` quanto o Dockerfile raiz usam `npm ci`.
- **[Pendente] `dist/index.html` versionado.** O arquivo segue rastreado pelo Git mesmo com `dist/` no `.gitignore`; builds ainda podem deixar diff no checkout.

## 3. Melhorias de UX nas funcionalidades existentes

- **[Feito] Home como painel do dia.** A Home lista vencimentos de hoje/amanhã e alertas de ativos, mostra o checklist de hoje com marcação direta dos itens, permite enviar o checklist quando ainda não houve poll, e compara gastos do mês com o limite configurado.
- **[Parcial] Gastos.** Filtros por mês/categoria e totais por categoria já existem; desfazer exclusão por alguns segundos ainda não.
- **[Fora do escopo atual] Marcar conta como paga.** O estado de pagamento foi removido pela migration 010 e a Home trata pendências pela data de vencimento; o registro opcional de pagamento não foi reintroduzido.
- **[Feito] Ativos.** Análise tem gráfico de evolução baseado em `asset_snapshots`; preço médio pode ser editado no formulário da carteira.
- **[Parcial] Checklists.** Streak atual/recorde aparece no ranking e em itens de hoje. Meta semanal configurável por item ainda não existe; o resumo semanal passou a mostrar frequência realizada por item.
- **[Parcial] WhatsApp.** `/gasto` confirma a categoria e o total geral de gastos do mês; não mostra total/meta da categoria. `/desfazer` para apagar o último lançamento ainda não existe.
- **[Parcial] PWA.** Existem ícones `favicon` e `apple-touch-icon`, mas não foram encontrados manifest nem service worker; instalação/offline não estão implementados.
- **[Pendente] Acessibilidade.** Não foi encontrada auditoria registrada de contraste e foco contra `design-system/rotina/MASTER.md`.

## 4. Futuras features

### Finanças

- **[Pendente] Importação de extrato (OFX/CSV)** do banco, categorização e deduplicação.
- **[Pendente] Metas de economia** com valor-alvo, data e progresso.
- **[Pendente] Receitas** para calcular saldo do mês.
- **[Parcial] Orçamento por categoria.** Há limites mensais separados para contas e gastos, mas não limites por categoria nem alertas em 80%/100% por categoria.
- **[Pendente] Detecção de assinaturas** e total anual.
- **[Pendente] Gasto por foto** de cupom via WhatsApp.

### Investimentos

- **[Pendente] Proventos** de ações/FIIs e rentabilidade total.
- **[Pendente] Renda fixa** (CDB, Tesouro e LCI).
- **[Pendente] Rebalanceamento** por alocação-alvo.
- **[Pendente] Relatório de IR** exportável.

### Rotina e hábitos

- **[Pendente] Lembretes livres** por linguagem natural no WhatsApp.
- **[Pendente] Horário por item de checklist** e enquetes separadas por período do dia.
- **[Pendente] Diário rápido** via `/nota` e linha do tempo.

### Plataforma

- **[Pendente] Contas compartilhadas** por casal/família.
- **[Pendente] Assistente em linguagem natural** no WhatsApp.
- **[Parcial] Exportação e backup.** Há exportação CSV do histórico de contas; ainda não há exportação/backup geral de todos os dados em JSON/CSV.
- **[Pendente] Exclusão de conta** pelo app com remoção dos dados associados.

## 5. Priorização

Impacto e esforço estimados de 1 a 3; a ordem favorece o que reduz risco antes do que adiciona tela.

| # | Item | Tipo | Impacto | Esforço | Estado em 2026-10-04 |
| --- | --- | --- | --- | --- | --- |
| 1 | CI com `tsc` + testes | Técnica | 3 | 1 | Pendente |
| 2 | Recuperar tick perdido do scheduler | Técnica | 3 | 1 | Feito |
| 3 | Monitor de sessão do WAHA | Técnica | 3 | 2 | Parcial |
| 4 | Esconder `err.message` em produção | Segurança | 2 | 1 | Pendente |
| 5 | Limpeza da dívida (pending-migrations, `npm ci`, `dist/`) | Técnica | 1 | 1 | Parcial (`npm ci` feito) |
| 6 | Orçamento por categoria + alerta | Feature | 3 | 2 | Parcial (limites mensais gerais existem) |
| 7 | Home como painel do dia | UX | 3 | 2 | Feito |
| 8 | Testes de rota com MySQL | Técnica | 3 | 3 | Pendente |
| 9 | Importação de extrato OFX/CSV | Feature | 3 | 3 | Pendente |
| 10 | Proventos e renda fixa | Feature | 2 | 3 | Pendente |
| 11 | Assistente em linguagem natural | Feature | 2 | 3 | Pendente |
| 12 | Contas compartilhadas | Feature | 2 | 3 | Pendente |

**Sugestão de ondas:**

1. **Fundação:** concluir os itens 1, 3 e 4; do item 5 restam a pasta `pending-migrations` e a retirada de `dist/` do índice.
2. **Controle do mês:** completar o item 6, mais receitas e metas de economia; o item 7 foi concluído.
3. **Base de testes e dados:** item 8, depois importação de extrato (9).
4. **Expansão:** investimentos (10), assistente (11) e compartilhamento (12).

## Perguntas em aberto

- Quantos usuários ativos o sistema tem hoje? Isso decide a urgência da concorrência no tick, que ainda é sequencial.
- Contas compartilhadas e exclusão de conta exigem rever o modelo `user_id` em todas as tabelas — vale planejar antes de crescer o schema.
