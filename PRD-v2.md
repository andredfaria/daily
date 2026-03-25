# BillSync — Product Requirements Document

| Campo | Valor |
|---|---|
| **Produto** | BillSync |
| **Versão do documento** | 2.0 |
| **Data** | Março 2026 |
| **Status** | Em revisão |
| **Stack** | React + TypeScript + Node.js + PostgreSQL + n8n + WAHA |

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Problema](#2-problema)
3. [Solução](#3-solução)
4. [Público-alvo](#4-público-alvo)
5. [Objetivos e Métricas de Sucesso](#5-objetivos-e-métricas-de-sucesso)
6. [Escopo do Produto](#6-escopo-do-produto)
7. [Requisitos Funcionais](#7-requisitos-funcionais)
8. [Requisitos Não Funcionais](#8-requisitos-não-funcionais)
9. [Arquitetura Técnica](#9-arquitetura-técnica)
10. [Especificação da API REST](#10-especificação-da-api-rest)
11. [Integrações Externas](#11-integrações-externas)
12. [Fluxos Críticos](#12-fluxos-críticos)
13. [Regras de Negócio](#13-regras-de-negócio)
14. [Casos de Borda e Tratamento de Erros](#14-casos-de-borda-e-tratamento-de-erros)
15. [Roadmap](#15-roadmap)
16. [Riscos e Dependências](#16-riscos-e-dependências)

---

## 1. Visão Geral

O **BillSync** é um sistema web pessoal para cadastro, gerenciamento e notificação automática de contas a pagar. Seu diferencial é a integração nativa com o WhatsApp: o usuário recebe alertas proativos com os dados de pagamento (chave PIX ou código de boleto) diretamente no app de mensagens que já usa no dia a dia, e pode confirmar o pagamento respondendo com uma palavra-chave na própria conversa.

O sistema é projetado inicialmente para uso individual, com arquitetura preparada para evoluir para multi-usuário (SaaS) sem refatorações de schema.

---

## 2. Problema

Contas recorrentes — aluguel, energia, internet, academias — são frequentemente esquecidas por falta de um sistema centralizado e proativo de acompanhamento.

**Soluções existentes falham por:**

- **Planilhas:** passivas, não enviam alertas, exigem consulta manual.
- **Aplicativos de finanças genéricos:** não integram com WhatsApp, que é o canal de comunicação primário do público-alvo.
- **Lembretes do calendário:** não incluem os dados de pagamento, exigem etapas adicionais.
- **Internet banking:** exige acesso ao app do banco para cada pagamento, sem visão consolidada.

**Consequências reais do problema:**
- Pagamento em atraso com incidência de juros e multas.
- Interrupção de serviços (internet, energia, plano de saúde).
- Dano ao score de crédito por atrasos recorrentes.
- Estresse financeiro por falta de visibilidade das obrigações futuras.

---

## 3. Solução

O BillSync resolve o problema com três pilares:

### 3.1 Cadastro centralizado
Uma interface web limpa onde o usuário cadastra todas as suas contas, define as regras de recorrência e associa os dados de pagamento (PIX e/ou boleto) a cada uma.

### 3.2 Notificação proativa no WhatsApp
O sistema envia automaticamente alertas no WhatsApp com **antecedência configurável** (padrão: 3 dias antes) e novamente **no dia do vencimento**, incluindo os dados completos para pagamento na própria mensagem.

### 3.3 Confirmação por conversa
O usuário confirma o pagamento respondendo `PAGO` na conversa do WhatsApp. O sistema reconhece a resposta, atualiza o status automaticamente e encerra o ciclo de lembretes para aquele vencimento.

---

## 4. Público-alvo

### 4.1 Perfil primário
- Pessoa física, Brasil
- Faixa etária: 25–45 anos
- Usa WhatsApp diariamente como canal principal de comunicação
- Tem 5–20 contas recorrentes mensais para gerenciar
- Sofreu ou teme sofrer atrasos por esquecimento

### 4.2 Perfil secundário (futuro — fase multi-usuário)
- Pequenos negócios e autônomos com obrigações financeiras recorrentes
- Famílias que compartilham gestão financeira

### 4.3 O que o usuário NÃO precisa saber
- Não precisa de conhecimento técnico
- Não precisa monitorar o sistema ativamente
- Não precisa acessar o app para confirmar pagamentos — o WhatsApp é suficiente

---

## 5. Objetivos e Métricas de Sucesso

### 5.1 Objetivo principal
> Eliminar o esquecimento de vencimentos de contas recorrentes.

### 5.2 Métricas de sucesso (fase v1 — uso pessoal)

| Métrica | Meta |
|---|---|
| Taxa de pagamentos confirmados via sistema | > 80% das ocorrências geradas |
| Tempo entre recebimento da notificação e pagamento | < 24 horas |
| Ocorrências marcadas como "atrasado" | < 10% do total mensal |
| Tempo para cadastrar uma nova conta | < 2 minutos |
| Disponibilidade do serviço | > 99% em horário útil |

### 5.3 Indicadores negativos (red flags)
- Mais de 3 falhas consecutivas de envio via WAHA sem alerta ao usuário
- Ocorrências geradas com data errada por bug no cálculo de recorrência
- Confirmações de pagamento via WhatsApp não sendo registradas

---

## 6. Escopo do Produto

### 6.1 Dentro do escopo (v1)

- Cadastro e edição de contas com recorrência mensal, semanal e avulsa
- Associação de métodos de pagamento PIX e Boleto por conta
- Geração automática de ocorrências de vencimento
- Envio de notificações WhatsApp via WAHA + n8n
- Confirmação de pagamento via resposta no WhatsApp
- Marcação manual de pagamento pela interface web
- Dashboard com próximos vencimentos e resumo financeiro mensal
- Histórico completo de ocorrências com filtros
- Configurações de perfil e preferências de notificação
- Desativação/reativação de contas sem exclusão

### 6.2 Fora do escopo (v1)

- Autenticação e múltiplos usuários
- Importação automática de extratos bancários
- Integração com open banking ou DDA (Débito Direto Autorizado)
- App mobile nativo
- Relatórios financeiros avançados (gráficos históricos, projeções)
- Pagamento integrado (o sistema apenas notifica, não executa o pagamento)
- Suporte a moedas além do BRL

---

## 7. Requisitos Funcionais

### 7.1 Gerenciamento de Contas

**RF-01 — Cadastrar conta**
O sistema deve permitir o cadastro de uma conta com: nome (obrigatório), descrição (opcional), valor em BRL (obrigatório), tipo de recorrência (obrigatório), dia/data de vencimento conforme recorrência (obrigatório), dias de antecedência para alerta (obrigatório, padrão 3), status ativo/inativo (padrão ativo).

**RF-02 — Editar conta**
O sistema deve permitir editar qualquer campo de uma conta existente. Ocorrências já pagas não devem ser afetadas.

**RF-03 — Desativar/reativar conta**
O sistema deve permitir suspender uma conta sem excluí-la. Contas inativas não geram novas ocorrências nem recebem notificações.

**RF-04 — Excluir conta**
O sistema deve permitir excluir permanentemente uma conta, removendo em cascata suas ocorrências, métodos de pagamento e notificações.

**RF-05 — Listar e filtrar contas**
O sistema deve exibir todas as contas com filtros por tipo de recorrência (mensal/semanal/avulsa) e por status (ativas/inativas).

### 7.2 Formas de Pagamento

**RF-06 — Associar métodos de pagamento**
Cada conta deve suportar um ou mais métodos de pagamento do tipo PIX ou Boleto.

**RF-07 — PIX**
Para o tipo PIX, o sistema deve armazenar: tipo de chave (CPF/CNPJ, e-mail, telefone, aleatória), valor da chave e nome do beneficiário.

**RF-08 — Boleto**
Para o tipo Boleto, o sistema deve armazenar o código de barras completo / linha digitável.

**RF-09 — Método principal**
Cada conta pode ter exatamente um método marcado como principal. O método principal é exibido em destaque nas notificações WhatsApp.

### 7.3 Ocorrências

**RF-10 — Geração de ocorrências mensais**
Para contas mensais, o sistema deve gerar uma ocorrência para o dia configurado em cada mês enquanto a conta estiver ativa.

**RF-11 — Geração de ocorrências semanais**
Para contas semanais, o sistema deve gerar uma ocorrência para o dia da semana configurado a cada semana enquanto a conta estiver ativa.

**RF-12 — Geração de ocorrência avulsa**
Para contas avulsas, o sistema deve gerar exatamente uma ocorrência na data informada.

**RF-13 — Status de ocorrências**
Cada ocorrência deve ter um dos seguintes status: `pending` (pendente), `paid` (paga), `overdue` (atrasada), `cancelled` (cancelada).

**RF-14 — Atualização automática para "atrasado"**
Ocorrências com `due_date` anterior à data atual e status `pending` devem ser marcadas como `overdue` automaticamente.

**RF-15 — Marcar como pago via web**
O usuário deve poder marcar uma ocorrência como paga diretamente pela interface, com registro da origem `web` e timestamp.

### 7.4 Notificações

**RF-16 — Agendamento de notificações**
Ao gerar uma ocorrência, o sistema deve criar automaticamente dois registros de notificação: um para X dias antes (alerta de antecedência) e um para o dia do vencimento.

**RF-17 — Envio diário via WAHA**
Um job automático deve rodar diariamente às 8h (America/Sao_Paulo) e enviar as notificações agendadas para o dia.

**RF-18 — Conteúdo da notificação**
A mensagem deve incluir: nome da conta, valor, data de vencimento com referência relativa, e os dados do método de pagamento principal.

**RF-19 — Registro de envio**
Após cada envio, o sistema deve registrar: status (`sent`/`failed`), timestamp do envio, ID da mensagem retornado pelo WAHA, e corpo da mensagem enviada.

**RF-20 — Não reenviar após pagamento**
Notificações ainda agendadas para uma ocorrência que foi marcada como paga devem ser canceladas (status `skipped`).

### 7.5 Confirmação via WhatsApp

**RF-21 — Webhook de confirmação**
O sistema deve expor um endpoint de webhook que o n8n chama ao receber uma mensagem do WhatsApp com palavra-chave de confirmação.

**RF-22 — Palavras-chave reconhecidas**
O sistema deve reconhecer as seguintes palavras-chave (case insensitive): `pago`, `ok`, `feito`, `confirmado`, `✅`.

**RF-23 — Identificação da ocorrência**
O sistema deve identificar qual ocorrência confirmar com base no número do remetente, buscando a ocorrência mais próxima no passado que ainda esteja pendente para aquele usuário.

**RF-24 — Registro da confirmação**
O sistema deve salvar `confirmation_source = 'whatsapp'`, o timestamp e a mensagem original recebida.

### 7.6 Dashboard

**RF-25 — Estatísticas do mês**
O dashboard deve exibir: total de contas ativas, ocorrências vencendo esta semana, total pago no mês (contagem e valor) e status da conexão WAHA.

**RF-26 — Próximos vencimentos**
O dashboard deve listar as próximas ocorrências dos próximos 30 dias, ordenadas por prioridade (atrasadas > vencendo hoje > pendentes futuras).

**RF-27 — Gráfico de resumo**
O dashboard deve exibir um gráfico donut com a distribuição de ocorrências do mês corrente por status (pago/pendente/atrasado).

### 7.7 Histórico

**RF-28 — Listagem completa**
A tela de histórico deve exibir todas as ocorrências, agrupadas por mês.

**RF-29 — Filtros**
O histórico deve permitir filtrar por: texto do nome da conta, mês/ano e status.

**RF-30 — Sumário por mês**
Cada grupo de mês deve exibir o total de ocorrências e o valor total pago no período.

**RF-31 — Origem do pagamento**
Cada ocorrência paga deve indicar a origem da confirmação: `VIA WHATSAPP`, `VIA WEB` ou `MANUAL`.

### 7.8 Configurações

**RF-32 — Perfil do usuário**
O usuário deve poder atualizar seu nome, número de WhatsApp e fuso horário.

**RF-33 — Preferências de notificação**
O usuário deve poder ativar/desativar alertas WhatsApp, ativar/desativar resumo semanal e configurar o padrão global de dias de antecedência.

---

## 8. Requisitos Não Funcionais

### 8.1 Performance

| Requisito | Meta |
|---|---|
| Tempo de resposta da API (endpoints de leitura) | < 300ms (p95) |
| Tempo de resposta da API (endpoints de escrita) | < 500ms (p95) |
| Tempo de carregamento inicial do frontend | < 2 segundos (LCP) |
| Capacidade de ocorrências no banco | Suportar 10.000+ sem degradação |

### 8.2 Confiabilidade

- O job de notificações diárias deve ter mecanismo de retry em caso de falha do WAHA (até 3 tentativas com intervalo exponencial).
- Falhas de notificação devem ser registradas com detalhes do erro para diagnóstico posterior.
- A indisponibilidade do WAHA não deve impactar as funcionalidades web do sistema.

### 8.3 Segurança

- Todos os dados de chave PIX e código de boleto devem ser armazenados com acesso restrito.
- A API deve validar e sanitizar todos os inputs para prevenir injeção de SQL e XSS.
- O endpoint de webhook (`/webhooks/whatsapp`) deve validar a origem das requisições (token de autenticação ou IP whitelist do n8n).
- Em fases futuras: autenticação JWT, HTTPS obrigatório, rate limiting.

### 8.4 Usabilidade

- Todas as ações destrutivas (excluir conta, limpar histórico) devem exigir confirmação explícita.
- O sistema deve fornecer feedback visual imediato para todas as ações do usuário (loading states, toasts de sucesso/erro).
- O tempo para cadastrar uma nova conta do zero deve ser inferior a 2 minutos.

### 8.5 Manutenibilidade

- Toda lógica de regra de negócio deve residir no backend (não no n8n).
- O n8n deve atuar apenas como orquestrador de integração.
- Alterações nos templates de mensagem WhatsApp devem ser possíveis sem deploy do backend.

---

## 9. Arquitetura Técnica

### 9.1 Visão geral das camadas

```
┌────────────────────────────────────────────────────────────┐
│  Frontend  (React + Vite + TypeScript + TailwindCSS)       │
│  http://localhost:5173                                      │
└───────────────────────┬────────────────────────────────────┘
                        │ HTTP / REST
┌───────────────────────▼────────────────────────────────────┐
│  Backend API  (Node.js + Express)                          │
│  http://localhost:4000/api                                  │
└──────┬──────────────────────────────────────┬──────────────┘
       │ SQL                                  │ HTTP
┌──────▼──────────────┐         ┌─────────────▼──────────────┐
│  PostgreSQL          │         │  n8n (automação)           │
│  (Supabase)          │         │  http://localhost:5678     │
└─────────────────────┘         └─────────────┬──────────────┘
                                               │ HTTP
                                ┌──────────────▼──────────────┐
                                │  WAHA (WhatsApp API)         │
                                │  http://localhost:3000       │
                                └─────────────────────────────┘
```

### 9.2 Stack por camada

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript | DX moderno, build rápido, type safety |
| Estilização | TailwindCSS v3 | Utilitários inline, sem overhead de CSS |
| Roteamento frontend | React Router v6 | Padrão de mercado, suporte a nested routes |
| HTTP client | axios | Interceptors, timeout, error handling padronizado |
| Datas | date-fns + locale pt-BR | Tree-shakeable, sem overhead do moment.js |
| Backend | Node.js + Express | Ecossistema familiar, rápido para APIs REST |
| Banco de dados | PostgreSQL via Supabase | UUID nativo, TIMESTAMPTZ, API automática |
| Automação | n8n (self-hosted) | Workflows visuais, fácil manutenção sem código |
| WhatsApp gateway | WAHA | API HTTP para WhatsApp, self-hosted |
| Hospedagem | VPS / Railway / Render | Flexibilidade e custo controlado |

### 9.3 Modelo de dados (entidades principais)

```
users
 └── bills (1:N)
      ├── payment_methods (1:N)
      └── bill_occurrences (1:N)
           └── notifications (1:N)
```

### 9.4 Variáveis de ambiente necessárias

```env
# Backend
DATABASE_URL=postgresql://...
PORT=4000
N8N_WEBHOOK_SECRET=...

# n8n
BILLSYNC_API_URL=http://localhost:4000/api
WAHA_API_URL=http://localhost:3000
WAHA_SESSION=default
```

---

## 10. Especificação da API REST

### 10.1 Usuários

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/api/users/me` | Retorna dados do usuário atual |
| `PATCH` | `/api/users/me` | Atualiza nome, WhatsApp, fuso horário e preferências |

### 10.2 Contas

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/api/bills` | Lista todas as contas (suporta filtros: `recurrence_type`, `is_active`) |
| `GET` | `/api/bills/:id` | Retorna uma conta com seus métodos de pagamento |
| `POST` | `/api/bills` | Cria nova conta |
| `PATCH` | `/api/bills/:id` | Atualiza dados de uma conta |
| `DELETE` | `/api/bills/:id` | Remove conta e todos os dados dependentes |

### 10.3 Métodos de Pagamento

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/api/bills/:id/payment-methods` | Lista métodos de pagamento de uma conta |
| `POST` | `/api/bills/:id/payment-methods` | Adiciona método de pagamento |
| `PATCH` | `/api/bills/:id/payment-methods/:methodId` | Atualiza método de pagamento |
| `DELETE` | `/api/bills/:id/payment-methods/:methodId` | Remove método de pagamento |

### 10.4 Ocorrências

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/api/occurrences` | Lista ocorrências (filtros: `status`, `bill_id`, `from`, `to`) |
| `GET` | `/api/occurrences/upcoming` | Próximas ocorrências (padrão: 30 dias) |
| `GET` | `/api/occurrences/stats` | Estatísticas para o dashboard |
| `GET` | `/api/occurrences/:id` | Retorna uma ocorrência específica |
| `PATCH` | `/api/occurrences/:id/pay` | Marca ocorrência como paga |
| `POST` | `/api/occurrences/generate` | Dispara geração de ocorrências futuras (chamado pelo n8n) |

### 10.5 Notificações

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/api/notifications/due-today` | Notificações a enviar hoje (chamado pelo n8n) |
| `PATCH` | `/api/notifications/:id/sent` | Marca notificação como enviada |
| `PATCH` | `/api/notifications/:id/failed` | Registra falha com detalhe do erro |

### 10.6 Webhooks

| Método | Endpoint | Descrição |
|---|---|---|
| `POST` | `/api/webhooks/whatsapp` | Recebe confirmação de pagamento do WAHA via n8n |

### 10.7 WAHA Status (proxy)

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/api/waha/status` | Verifica status da sessão WAHA |

---

## 11. Integrações Externas

### 11.1 WAHA (WhatsApp HTTP API)

O WAHA é um servidor self-hosted que expõe uma API HTTP para envio e recebimento de mensagens no WhatsApp via protocolo Web. O BillSync usa o WAHA exclusivamente via n8n — o backend nunca chama o WAHA diretamente.

**Operações utilizadas:**

| Operação WAHA | Chamado por | Quando |
|---|---|---|
| `POST /api/sendText` | n8n | Envio de notificações |
| Webhook de mensagem recebida | n8n (receptor) | Confirmação de pagamento pelo usuário |

**Configuração necessária:**
- Sessão WAHA autenticada com QR Code do WhatsApp
- URL base configurada no n8n como variável de ambiente
- Número do usuário cadastrado no perfil do BillSync

### 11.2 n8n (Automação)

O n8n conecta o backend do BillSync ao WAHA. Nenhuma regra de negócio vive no n8n — ele apenas lê da API, formata e delega.

**Workflows obrigatórios:**

**Workflow 1 — Disparo diário de notificações**
```
Cron (8h) → GET /notifications/due-today → Para cada notificação:
  → Formata mensagem → WAHA sendText
  → Sucesso: PATCH /notifications/:id/sent
  → Falha:   PATCH /notifications/:id/failed
```

**Workflow 2 — Confirmação via WhatsApp**
```
Webhook WAHA (mensagem recebida)
  → Extrai número e texto
  → Contém palavra-chave? → Não: ignora
  → Sim: GET /occurrences/upcoming (filtrado por usuário)
  → PATCH /occurrences/:id/pay (source: whatsapp)
  → WAHA sendText ("✅ Pagamento registrado!")
```

**Workflow 3 — Geração mensal de ocorrências**
```
Cron (último dia do mês, 23h)
  → POST /occurrences/generate
```

**Workflow 4 — Resumo semanal** *(opcional, controlado por preferências)*
```
Cron (toda segunda, 9h)
  → GET /occurrences (mês corrente)
  → Compila resumo de pagos e pendentes
  → WAHA sendText (relatório formatado)
```

---

## 12. Fluxos Críticos

### 12.1 Fluxo completo de uma conta mensal — do cadastro ao pagamento confirmado

```
1. Usuário cadastra "Aluguel" — R$ 2.850,00 — dia 5 — 3 dias antes
2. Backend cria registro em `bills`
3. Backend cria registro em `payment_methods` (PIX)
4. Backend gera ocorrência para o dia 5 do mês corrente → status: pending
5. Backend agenda 2 notificações:
   - Dia 2 (3 dias antes) → type: before_due
   - Dia 5 (dia do vencimento) → type: on_due_date
─── No dia 2 às 8h ───
6. n8n lê notificação do dia 2 via GET /notifications/due-today
7. n8n formata mensagem com dados do aluguel + chave PIX
8. n8n envia via WAHA para o número do usuário
9. Backend registra sent_at e status: sent
─── No dia 5 às 9h ───
10. Usuário recebe segundo lembrete "Vence HOJE"
11. Usuário faz o pagamento
12. Usuário responde "pago" no WhatsApp
13. WAHA detecta a resposta e dispara webhook para o n8n
14. n8n identifica a ocorrência pendente do usuário
15. n8n chama PATCH /occurrences/:id/pay (source: whatsapp)
16. Backend atualiza ocorrência: status: paid, paid_at: now()
17. Backend cancela notificações restantes (status: skipped)
18. n8n envia confirmação: "✅ Pagamento do Aluguel registrado!"
─── Fim do mês ───
19. Job de geração cria ocorrência para o dia 5 do próximo mês
20. Ciclo reinicia
```

### 12.2 Marcação manual via web

```
1. Usuário acessa Dashboard
2. Visualiza "Aluguel" com status PENDENTE
3. Clica em "Marcar como Pago"
4. Frontend exibe spinner, chama PATCH /occurrences/:id/pay (source: web)
5. Backend atualiza status, cancela notificações pendentes
6. Frontend anima badge: PENDENTE → PAGO (flash verde)
7. Toast: "Pagamento registrado!"
```

---

## 13. Regras de Negócio

### RN-01 — Recorrência mensal com dias inválidos
Se o dia de vencimento configurado não existir no mês (ex: dia 31 em fevereiro), o sistema deve usar o último dia válido do mês.

### RN-02 — Geração de ocorrência única (avulsa)
Contas avulsas geram uma única ocorrência. Após a ocorrência ser paga ou cancelada, a conta deve ser automaticamente desativada.

### RN-03 — Método de pagamento principal
Cada conta deve ter exatamente um método marcado como `is_primary`. Se nenhum for marcado, o primeiro método cadastrado assume o papel de principal. Se o método principal for removido, o próximo disponível se torna principal.

### RN-04 — Cancelamento de notificações ao pagar
Ao marcar uma ocorrência como paga (por qualquer origem), todas as notificações com status `scheduled` vinculadas a ela devem ser canceladas (status `skipped`).

### RN-05 — Não duplicar notificações
O job de disparo diário não deve reenviar notificações já com status `sent`. Apenas notificações com status `scheduled` e `scheduled_for` igual à data atual devem ser processadas.

### RN-06 — Identificação de confirmação por WhatsApp
Quando múltiplas ocorrências estiverem pendentes para o mesmo usuário, o sistema deve priorizar a ocorrência com `due_date` mais próxima do passado (mais atrasada primeiro), depois a mais próxima no futuro.

### RN-07 — Valor da ocorrência
O valor da ocorrência é herdado do campo `amount` da conta no momento da geração. Edições posteriores no valor da conta não afetam ocorrências já geradas.

### RN-08 — Fuso horário
Todos os cálculos de data de vencimento e agendamento de notificações devem respeitar o fuso horário configurado no perfil do usuário (padrão: `America/Sao_Paulo`).

---

## 14. Casos de Borda e Tratamento de Erros

### 14.1 WAHA indisponível

- O backend não deve ficar bloqueado esperando resposta do WAHA.
- O n8n deve registrar a falha via `PATCH /notifications/:id/failed`.
- Após X falhas consecutivas (configurável), o n8n pode enviar um alerta de sistema.
- As notificações falhadas ficam registradas para diagnóstico e possível reenvio manual.

### 14.2 Usuário responde palavra-chave sem ocorrência pendente

- Se nenhuma ocorrência pendente for encontrada para o número do remetente, o n8n deve ignorar silenciosamente (sem mensagem de erro ao usuário) ou enviar uma mensagem neutra: "Nenhum pagamento pendente encontrado."

### 14.3 Conta mensal no dia 31 em meses com menos dias

- O sistema usa o último dia válido do mês. Ex: conta com dia 31 → em fevereiro vence no dia 28 (ou 29 em ano bissexto).

### 14.4 Cadastro de conta com data avulsa no passado

- O sistema deve aceitar o cadastro mas gerar a ocorrência com status `overdue` diretamente, sem agendar notificações (já está vencida).

### 14.5 Exclusão de conta com ocorrências pagas

- O sistema deve alertar o usuário que o histórico de pagamentos daquela conta também será excluído.
- A confirmação no modal deve mencionar explicitamente a perda do histórico.

### 14.6 API do backend indisponível

- O frontend deve exibir estados de erro claros por seção, sem travar a navegação.
- Toast de erro: "Erro ao carregar dados. Verifique sua conexão."
- As demais seções da página devem funcionar normalmente se suas chamadas retornarem com sucesso.

---

## 15. Roadmap

### Fase 1 — Fundação (concluída)
- [x] Setup do projeto: Vite + React + TypeScript + TailwindCSS
- [x] Design system e componentes base
- [x] Todas as telas do frontend implementadas
- [x] Estrutura de API definida e tipada

### Fase 2 — Backend Core
- [ ] Setup do projeto Node.js + Express
- [ ] Conexão com PostgreSQL via Supabase
- [ ] Migrations do banco de dados
- [ ] CRUD completo de `bills` + `payment_methods`
- [ ] Endpoint de geração de ocorrências
- [ ] Testes de integração dos endpoints principais

### Fase 3 — Frontend conectado
- [ ] Integração do frontend com todos os endpoints do backend
- [ ] Substituição dos estados de loading/erro fictícios
- [ ] Testes de fluxo completo (cadastro → ocorrência → pagamento)

### Fase 4 — Notificações WhatsApp
- [ ] Setup do n8n self-hosted
- [ ] Setup do WAHA self-hosted + autenticação da sessão
- [ ] Workflow 1: Disparo diário de notificações
- [ ] Workflow 3: Geração mensal de ocorrências
- [ ] Testes end-to-end do fluxo de notificação

### Fase 5 — Confirmação via WhatsApp
- [ ] Workflow 2: Recebimento e processamento de confirmações
- [ ] Endpoint de webhook no backend
- [ ] Testes de identificação correta de ocorrências por número

### Fase 6 — Polimento e estabilização
- [ ] Tratamento robusto de casos de borda (RN-01 a RN-08)
- [ ] Monitoramento de falhas de notificação
- [ ] Testes de carga básicos
- [ ] Documentação de operação (como reconfigurar WAHA, rodar backups)

### Fase 7 — Multi-usuário *(futuro)*
- [ ] Autenticação (Supabase Auth ou JWT próprio)
- [ ] Isolamento de dados por `user_id` em todas as queries
- [ ] Painel de administração
- [ ] Planos e limites de uso (SaaS)

---

## 16. Riscos e Dependências

### 16.1 Riscos técnicos

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Sessão WAHA desconectando periodicamente | Alta | Alto | Monitoramento automático + alerta no Dashboard |
| WhatsApp bloqueando número por envios em massa | Média | Alto | Uso pessoal (1 usuário, volume baixo) reduz risco |
| n8n offline no horário do job | Média | Médio | Retry automático; notificações registradas para análise |
| Bug no cálculo de datas de recorrência | Baixa | Alto | Testes unitários cobrindo todos os casos de borda |
| Supabase atingindo limite do plano gratuito | Baixa | Médio | Monitorar uso; upgrade de plano ou migrar para VPS próprio |

### 16.2 Dependências externas

| Dependência | Criticidade | Observação |
|---|---|---|
| WAHA | Crítica | Toda a comunicação WhatsApp depende desta ferramenta self-hosted |
| n8n | Alta | Orquestra todos os fluxos automáticos |
| Supabase | Alta | Banco de dados principal |
| Número de WhatsApp ativo | Crítica | Número deve permanecer ativo e autenticado no WAHA |

### 16.3 Premissas

- O usuário tem acesso a um servidor ou VPS para hospedar WAHA e n8n self-hosted.
- O número de WhatsApp usado não é um número de negócio oficial (WhatsApp Business API), que tem restrições e custos diferentes.
- O volume de notificações é compatível com uso pessoal (< 50 mensagens/dia).

---

*Documento gerado em 25/03/2026 · BillSync PRD v2.0*
