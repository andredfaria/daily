# BillSync — Documento de Funcionalidades

> Versão: 1.0 · Março 2026
> Este documento descreve todas as funcionalidades do sistema BillSync, seu comportamento esperado no backend, fluxo de execução e onde as informações são manipuladas. Não aborda estrutura de banco de dados.

---

## Índice

1. [Cadastro de Contas](#1-cadastro-de-contas)
2. [Edição de Contas](#2-edição-de-contas)
3. [Desativação e Reativação de Contas](#3-desativação-e-reativação-de-contas)
4. [Exclusão de Contas](#4-exclusão-de-contas)
5. [Formas de Pagamento](#5-formas-de-pagamento)
6. [Geração de Ocorrências](#6-geração-de-ocorrências)
7. [Marcação de Pagamento via Web](#7-marcação-de-pagamento-via-web)
8. [Notificações via WhatsApp (WAHA)](#8-notificações-via-whatsapp-waha)
9. [Confirmação de Pagamento via WhatsApp](#9-confirmação-de-pagamento-via-whatsapp)
10. [Dashboard e Estatísticas](#10-dashboard-e-estatísticas)
11. [Histórico de Ocorrências](#11-histórico-de-ocorrências)
12. [Perfil do Usuário](#12-perfil-do-usuário)
13. [Preferências de Notificação](#13-preferências-de-notificação)

---

## 1. Cadastro de Contas

### O que é
Permite ao usuário registrar uma conta a pagar no sistema, definindo suas regras de recorrência, valor e dados de pagamento.

### Fluxo de execução

1. O usuário acessa `/contas/nova` e preenche o formulário.
2. O frontend valida os campos obrigatórios (nome, valor, tipo de recorrência e respectivo campo de data/dia).
3. Ao confirmar, o frontend envia um `POST /api/bills` com os dados da conta.
4. O backend persiste a conta e, em seguida, o frontend envia os métodos de pagamento via `POST /api/bills/:id/payment-methods` para cada forma cadastrada.
5. Após salvar tudo, o usuário é redirecionado para a listagem `/contas`.

### Campos da conta

| Campo | Obrigatoriedade | Comportamento |
|---|---|---|
| Nome | Obrigatório | Texto livre. Usado para identificar a conta e derivar o ícone. |
| Descrição | Opcional | Anotação adicional. |
| Valor | Obrigatório | Decimal em BRL. Formatado com máscara monetária. |
| Tipo de Recorrência | Obrigatório | `Mensal`, `Semanal` ou `Avulsa`. Define o campo de data dinâmico abaixo. |
| Dia do mês | Se `Mensal` | Número de 1 a 31. Define quando a ocorrência vence todo mês. |
| Dia da semana | Se `Semanal` | Seleção visual (Dom–Sáb). Define o dia de vencimento semanal. |
| Data de vencimento | Se `Avulsa` | Data exata para uma ocorrência única. |
| Dias de antecedência | Obrigatório | Quantos dias antes do vencimento o aviso é enviado. Padrão: 3. |
| Ativa | Toggle | Define se a conta gera notificações e ocorrências. |

### Onde os dados são armazenados
- A conta é salva na coleção/tabela de **contas** (`bills`).
- Cada forma de pagamento é salva em **métodos de pagamento** (`payment_methods`), vinculada ao ID da conta.
- Ao ser criada, o backend também é responsável por acionar a [geração de ocorrências](#6-geração-de-ocorrências).

---

## 2. Edição de Contas

### O que é
Permite modificar qualquer campo de uma conta já cadastrada, incluindo seus métodos de pagamento.

### Fluxo de execução

1. O usuário acessa `/contas/:id/editar`.
2. O frontend carrega os dados existentes via `GET /api/bills/:id` e preenche o formulário.
3. Os métodos de pagamento existentes são carregados separadamente via `GET /api/bills/:id/payment-methods`.
4. Ao confirmar, o frontend envia `PATCH /api/bills/:id` com os campos alterados da conta.
5. Os métodos de pagamento são reconciliados:
   - Métodos **removidos** pelo usuário são excluídos via `DELETE /api/bills/:id/payment-methods/:methodId`.
   - Métodos **novos** são criados via `POST /api/bills/:id/payment-methods`.
   - Métodos **existentes sem alteração** são mantidos sem chamada adicional.
6. O usuário é redirecionado para `/contas` após o salvamento.

### Impacto nas ocorrências
- Se o valor ou as regras de recorrência forem alterados, o backend deve avaliar se ocorrências futuras ainda pendentes precisam ser recalculadas ou se apenas as novas gerarão o novo valor.
- Ocorrências já pagas não são afetadas por edições.

### Onde os dados são armazenados
- Atualizações refletem diretamente no registro da conta em **bills**.
- Métodos de pagamento são adicionados, removidos ou mantidos em **payment_methods**.

---

## 3. Desativação e Reativação de Contas

### O que é
Permite suspender temporariamente uma conta sem excluí-la, impedindo a geração de novas ocorrências e o envio de notificações.

### Fluxo de execução

1. Na tela de listagem (`/contas`), cada card de conta exibe um toggle ativo/inativo.
2. Ao clicar, o frontend envia `PATCH /api/bills/:id` com `{ is_active: false }` (ou `true`).
3. O backend atualiza o campo `is_active` da conta.
4. O frontend atualiza o estado local do card sem recarregar toda a lista.

### Comportamento no backend
- Contas inativas **não** geram novas ocorrências no ciclo de geração automática.
- Contas inativas **não** disparam notificações via WAHA.
- Ocorrências já geradas e ainda pendentes **permanecem** no sistema e podem ser pagas manualmente.
- A conta pode ser reativada a qualquer momento, retomando o ciclo normal.

### Onde os dados são armazenados
- O campo `is_active` é atualizado no registro correspondente em **bills**.

---

## 4. Exclusão de Contas

### O que é
Remove permanentemente uma conta do sistema, junto com todos os seus registros dependentes.

### Fluxo de execução

1. O usuário abre o menu de três pontos em um card de conta e clica em "Excluir".
2. Um modal de confirmação é exibido com o nome da conta.
3. Ao confirmar, o frontend envia `DELETE /api/bills/:id`.
4. O backend exclui a conta e, em cascata, todos os seus **métodos de pagamento**, **ocorrências** e **notificações** vinculadas.
5. O card é removido da listagem local sem recarregar a página.

### Irreversibilidade
A exclusão é permanente. Todo o histórico de ocorrências daquela conta é perdido. O modal de confirmação existe justamente para evitar exclusões acidentais.

### Onde os dados são removidos
- Registro da conta em **bills**.
- Todos os registros em **payment_methods** com aquele `bill_id`.
- Todos os registros em **bill_occurrences** com aquele `bill_id`.
- Todos os registros em **notifications** vinculados às ocorrências excluídas.

---

## 5. Formas de Pagamento

### O que é
Cada conta pode ter uma ou mais formas de pagamento associadas (PIX e/ou Boleto), usadas nas mensagens de notificação enviadas pelo WhatsApp.

### Tipos suportados

#### PIX
| Campo | Descrição |
|---|---|
| Tipo de chave | CPF/CNPJ, E-mail, Telefone ou Chave Aleatória |
| Chave PIX | O valor da chave |
| Nome do beneficiário | Nome de quem vai receber |

#### Boleto
| Campo | Descrição |
|---|---|
| Código de barras / Linha digitável | O código completo do boleto |

### Método principal
- Cada conta pode ter um método marcado como **principal** (`is_primary: true`).
- O método principal é o que aparece em destaque nas notificações do WhatsApp.
- Somente um método pode ser principal por vez.

### Fluxo de execução (criação)
1. O usuário adiciona métodos durante o cadastro ou edição da conta.
2. Após salvar a conta, cada método é enviado via `POST /api/bills/:id/payment-methods`.
3. O backend valida os campos obrigatórios por tipo (ex: chave PIX obrigatória se tipo for PIX).
4. Os métodos são armazenados vinculados ao `bill_id`.

### Onde os dados são armazenados
- Cada método é um registro em **payment_methods**, com referência à conta pai.

---

## 6. Geração de Ocorrências

### O que é
Ocorrências são os vencimentos concretos gerados a partir das regras de recorrência de cada conta. São elas que aparecem no Dashboard e no Histórico.

### Regras de geração por tipo

| Tipo | Lógica |
|---|---|
| **Mensal** | Gera uma ocorrência para o dia configurado no mês corrente (e nos próximos meses). |
| **Semanal** | Gera ocorrências para o dia da semana configurado, nas próximas semanas. |
| **Avulsa** | Gera uma única ocorrência na data exata informada no cadastro. |

### Quando a geração acontece

- **No cadastro da conta:** o backend gera imediatamente as próximas ocorrências (ex: o próximo vencimento mensal, as próximas 4 ocorrências semanais).
- **Job automático (via n8n):** um cron job executa diariamente ou mensalmente chamando `POST /api/occurrences/generate`, que percorre todas as contas ativas e garante que haja ocorrências futuras geradas com antecedência suficiente.
- **Contas avulsas:** uma única ocorrência é gerada no momento do cadastro. Não há regeneração.

### Fluxo de execução (job automático)

1. O n8n dispara o job via `POST /api/occurrences/generate`.
2. O backend percorre todas as contas com `is_active = true`.
3. Para cada conta, verifica se já existe uma ocorrência futura gerada.
4. Se não houver, calcula a próxima data de vencimento e cria o registro com status `pending`.
5. Junto à ocorrência, agenda as notificações correspondentes (antecedência e no dia).

### Onde os dados são armazenados
- Cada ocorrência é um registro em **bill_occurrences**.
- As notificações agendadas são registradas em **notifications** com status `scheduled`.

---

## 7. Marcação de Pagamento via Web

### O que é
Permite que o usuário confirme manualmente que uma conta foi paga, diretamente pela interface web — sem precisar passar pelo WhatsApp.

### Fluxo de execução

1. No Dashboard, cada ocorrência pendente ou atrasada exibe o botão "Marcar como Pago".
2. Ao clicar, o botão exibe um spinner de carregamento.
3. O frontend envia `PATCH /api/occurrences/:id/pay` com `{ confirmation_source: 'web' }`.
4. O backend atualiza a ocorrência: `status = 'paid'`, `paid_at = now()`, `confirmation_source = 'web'`.
5. O backend também cancela notificações ainda agendadas para aquela ocorrência (status `scheduled` → `skipped`).
6. O frontend anima o badge de status de PENDENTE para PAGO com um flash verde.
7. As estatísticas do Dashboard são atualizadas localmente.

### Onde os dados são armazenados
- O status da ocorrência é atualizado em **bill_occurrences**.
- As notificações vinculadas têm status atualizado para `skipped` em **notifications**.

---

## 8. Notificações via WhatsApp (WAHA)

### O que é
O sistema envia alertas automáticos pelo WhatsApp do usuário antes e no dia do vencimento de cada conta, incluindo os dados de pagamento (chave PIX ou código de boleto).

### Tipos de notificação

| Tipo | Quando é disparado |
|---|---|
| **Alerta de antecedência** | X dias antes do vencimento (configurável por conta). |
| **Alerta no dia** | Na manhã do dia de vencimento. |

### Fluxo de execução (disparo diário)

1. O n8n executa um cron job todo dia às 8h (horário de Brasília).
2. O n8n consulta `GET /api/notifications/due-today`, que retorna todas as notificações com `status = 'scheduled'` e `scheduled_for` igual ao dia atual.
3. Para cada notificação retornada:
   a. O n8n monta a mensagem com nome da conta, valor, data de vencimento e dados de pagamento.
   b. O n8n envia a mensagem via WAHA (`POST /waha/sendText`) para o número do usuário.
   c. Se o envio for bem-sucedido, o n8n chama `PATCH /api/notifications/:id/sent` → backend atualiza `status = 'sent'` e `sent_at = now()`.
   d. Se o envio falhar, o n8n chama `PATCH /api/notifications/:id/failed` → backend atualiza `status = 'failed'` e salva o detalhe do erro.

### Template da mensagem (antecedência)
```
⏰ Lembrete de Conta — BillSync

📌 Conta: [nome]
💰 Valor: R$ [valor]
📅 Vencimento: [data] (em X dias)

🏦 Formas de pagamento:
PIX → [tipo]: [chave] ([beneficiário])
Boleto → [código]
```

### Template da mensagem (no dia)
```
🚨 Vence HOJE — BillSync

📌 Conta: [nome]
💰 Valor: R$ [valor]
📅 Vencimento: HOJE, [data]

🏦 PIX → [tipo]: [chave] ([beneficiário])
```

### Onde os dados são armazenados
- Cada notificação tem seu status atualizado em **notifications** (`scheduled` → `sent` ou `failed`).
- O campo `waha_message_id` armazena o ID retornado pelo WAHA para rastreabilidade.
- O campo `message_body` armazena o texto exato enviado (auditoria).

---

### Onde os dados são armazenados
- Status da ocorrência atualizado para `paid` em **bill_occurrences**.
- O campo `whatsapp_msg` guarda o texto original da mensagem recebida.
- O campo `confirmation_source` registra `'whatsapp'` para diferenciação no histórico.

---

## 10. Dashboard e Estatísticas

### O que é
Tela inicial do sistema com uma visão consolidada do estado financeiro atual: contas próximas do vencimento, resumo mensal e indicadores de status.

### Componentes e dados exibidos

#### Cards de Estatísticas

| Card | Dado exibido | Fonte |
|---|---|---|
| Contas Ativas | Quantidade de contas com `is_active = true` | `GET /api/occurrences/stats` ou `GET /api/bills` |
| Vencem Esta Semana | Ocorrências com `due_date` nos próximos 7 dias e `status = 'pending'` ou `'overdue'` | `GET /api/occurrences/upcoming` |
| Pagas Este Mês | Quantidade e valor total das ocorrências pagas no mês corrente | `GET /api/occurrences/stats` |
| Status WAHA | Indicador de conexão do WhatsApp (polling a cada 30s) | `GET /api/waha/status` |

#### Lista de Próximos Vencimentos

- Carregada via `GET /api/occurrences/upcoming` (janela de 30 dias por padrão).
- Ordenada por prioridade: **atrasadas primeiro**, depois pendentes por data mais próxima.
- Cada item exibe: ícone da conta, nome, valor, data relativa (Hoje/Amanhã/Em X dias/Atrasado) e badge de status.
- Botão "Marcar como Pago" disponível para ocorrências `pending` e `overdue`.

#### Gráfico Donut — Resumo do Mês

- Exibido em SVG puro, sem biblioteca externa.
- Segmentos: **Pagas** (verde), **Pendentes** (amarelo/primário), **Atrasadas** (vermelho).
- Centro: total de ocorrências no mês.
- Legenda com contagem e valor somado de cada segmento.

### Fluxo de execução

1. Ao carregar o Dashboard, o frontend dispara em paralelo:
   - `GET /api/occurrences/upcoming`
   - `GET /api/occurrences/stats`
2. Os dados são usados tanto para os cards quanto para o gráfico.
3. A marcação de pagamento atualiza o estado local diretamente, sem recarregar a página.

---

## 11. Histórico de Ocorrências

### O que é
Tela que exibe todas as ocorrências registradas no sistema, organizadas cronologicamente por mês, com filtros avançados.

### Filtros disponíveis

| Filtro | Comportamento |
|---|---|
| Busca por nome | Filtragem em tempo real pelo nome da conta associada à ocorrência. |
| Mês/Ano | Restringe a visualização ao mês selecionado. O seletor é populado com os meses disponíveis nas ocorrências carregadas. |
| Status | Chips para filtrar por: Todos, Pago, Pendente, Atrasado, Cancelado. |

### Estrutura da timeline

- Ocorrências são agrupadas por mês (`Março 2026`, `Fevereiro 2026`, etc.).
- Cada cabeçalho de mês exibe um sumário: total de ocorrências e valor total pago no mês.
- Dentro de cada mês, as ocorrências são ordenadas por data de vencimento (mais recentes primeiro).
- Cada linha exibe:
  - Barra colorida lateral (verde = pago, amarelo = pendente, vermelho = atrasado, cinza = cancelado).
  - Nome da conta e badge de recorrência (MENSAL / SEMANAL / AVULSO).
  - Data de vencimento e, se pago, data e hora do pagamento.
  - Badge de origem: `VIA WHATSAPP` (verde) · `VIA WEB` (azul/primário) · `MANUAL` (cinza).
  - Valor e badge de status.

### Fluxo de execução

1. Ao carregar a tela, o frontend chama `GET /api/occurrences` sem filtros de data, recebendo o histórico completo (ou paginado).
2. O agrupamento por mês é feito no frontend com memoização para evitar recálculos desnecessários.
3. Os filtros aplicados reduzem o conjunto exibido sem novas chamadas à API.

### FAB — Ação Flutuante
- Botão fixo no canto inferior direito redireciona para `/contas/nova`.

---

## 12. Perfil do Usuário

### O que é
Seção de configurações onde o usuário mantém seus dados de contato, usados nas notificações e no sistema.

### Dados gerenciados

| Campo | Uso |
|---|---|
| Nome | Identificação no sistema. |
| Número WhatsApp | Número para onde as notificações são enviadas (formato: `+55DDDNÚMERO`). |
| Fuso horário | Define o horário base para agendamento de notificações (padrão: `America/Sao_Paulo`). |

### Fluxo de execução

1. Ao acessar Configurações, o frontend carrega os dados do usuário via `GET /api/users/me`.
2. Se a API não estiver disponível, um perfil placeholder é usado para não bloquear a navegação.
3. O botão "Editar Perfil" ativa o modo de edição inline.
4. Ao salvar, o frontend envia `PATCH /api/users/me` com os campos alterados.
5. O estado local é atualizado sem recarregar a página.

### Onde os dados são armazenados
- Os dados do usuário são persistidos em **users**.

---

## 13. Preferências de Notificação

### O que é
Permite ao usuário controlar quais tipos de alertas automáticos deseja receber e com quanta antecedência.

### Configurações disponíveis

| Configuração | Tipo | Descrição |
|---|---|---|
| Alertas WhatsApp | Toggle | Ativa/desativa o envio de notificações de vencimento via WhatsApp. |
| Resumo Semanal | Toggle | Ativa/desativa o envio de um resumo financeiro toda semana. |
| Dias de antecedência | Número (0–30) | Define o padrão global de dias antes do vencimento para o primeiro aviso. Pode ser sobrescrito por conta. |

### Comportamento no backend

- Quando **Alertas WhatsApp** está desativado, o job de disparo diário do n8n deve ignorar notificações daquele usuário.
- A configuração de **dias de antecedência** global é usada como fallback quando uma conta não tem um valor próprio definido.
- O **Resumo Semanal** aciona um workflow separado no n8n, que compila as contas pagas e pendentes da semana e envia um relatório consolidado.

### Fluxo de execução

1. As preferências são exibidas com os valores atuais do usuário.
2. Ao clicar em "Salvar", o frontend envia `PATCH /api/users/me` com os campos de preferência atualizados.
3. O backend persiste as preferências e elas passam a ser respeitadas pelo n8n no próximo ciclo de disparo.

### Onde os dados são armazenados
- As preferências de notificação são campos do registro do usuário em **users**.

---

## Apêndice — Integrações Externas

### WAHA (WhatsApp HTTP API)

O WAHA é o gateway de comunicação com o WhatsApp. O backend do BillSync não se comunica diretamente com o WhatsApp — toda a orquestração de envio e recebimento passa pelo n8n.

| Operação | Responsável | Endpoint envolvido |
|---|---|---|
| Verificar status da conexão | Header do frontend (polling 30s) | `GET /api/waha/status` |
| Enviar notificação | n8n (cron diário) | WAHA `POST /api/sendText` |
| Receber confirmação | n8n (webhook WAHA) | `PATCH /api/occurrences/:id/pay` |

### n8n (Automação)

O n8n atua como camada de orquestração entre o backend BillSync e o WAHA. Nenhuma lógica de regra de negócio vive no n8n — ele apenas consulta a API, formata mensagens e delega ações de volta ao backend.

| Workflow | Trigger | Ação |
|---|---|---|
| Disparo de notificações | Cron diário às 8h | Consulta notificações do dia e envia via WAHA |
| Geração de ocorrências | Cron mensal (último dia do mês) | Chama `POST /api/occurrences/generate` |
| Confirmação de pagamento | Webhook do WAHA (mensagem recebida) | Identifica ocorrência e chama `PATCH /occurrences/:id/pay` |
| Resumo semanal | Cron semanal (toda segunda) | Compila dados e envia mensagem de resumo |

---

*Documento gerado em 25/03/2026 · BillSync v1.0*
