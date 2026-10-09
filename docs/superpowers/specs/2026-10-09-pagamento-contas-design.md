# Marcar conta como paga — design

Data: 2026-10-09

## Objetivo

Registrar que uma conta do mês foi paga, pela interface e pelo WhatsApp. Na conta
variável, o pagamento informa o valor real. Marcar como paga para os lembretes
ainda não enviados daquele vencimento. Análise, fechamento e resumo semanal **não**
mudam nesta etapa (pago x pendente nos números fica para depois).

## Dados

Migration `027_pagamento_ocorrencia` em `backend/src/migrate.ts`:

- `bill_occurrences.paid_at DATETIME NULL` (depois de `amount_is_actual`)
- `bill_occurrences.paid_source ENUM('app','whatsapp') NULL` (depois de `paid_at`)

Paga = `paid_at IS NOT NULL`. Não há coluna `status`.

## Qual vencimento é marcado

O "vencimento atual" da conta: a primeira ocorrência com
`due_date >= primeiro dia do mês corrente` (São Paulo), em ordem de data — a mesma
regra do `ocorrencia_atual` de `GET /api/bills`. Ocorrências antigas não têm
registro de pagamento, por isso não se usa "a mais antiga em aberto".

## Serviço `backend/src/services/billPayment.ts`

Banco + regra, usado pela rota e pelo comando:

```ts
export type OrigemPagamento = 'app' | 'whatsapp'
export interface OcorrenciaPaga {
  id: string; bill_id: string; due_date: string /* YYYY-MM-DD */
  amount: number; amount_is_actual: number; paid_at: string | null; paid_source: OrigemPagamento | null
}
// Lança ErroPagamento('valor_obrigatorio') se a conta é variável e amount é null/undefined.
// Conta fixa ignora amount. Variável grava amount + amount_is_actual = 1.
// Marca notifications 'scheduled' da ocorrência como 'skipped'.
export async function marcarPaga(occurrenceId: string, origem: OrigemPagamento, amount?: number | null): Promise<OcorrenciaPaga>
// Zera paid_at/paid_source. Valor real informado continua.
export async function desmarcarPaga(occurrenceId: string): Promise<OcorrenciaPaga>
// Vencimento atual da conta (regra acima) ou null.
export async function ocorrenciaAtualDaConta(billId: string): Promise<OcorrenciaPaga | null>
```

A checagem de dono (user_id) é da rota/handler, antes de chamar o serviço.

## API

- `POST /api/occurrences/:id/pagar` body `{ amount?: number | null }` → 200 `OcorrenciaPaga`.
  404 se a ocorrência não é do usuário; 400 `{ error: 'Informe o valor pago da conta variável' }`
  sem valor na variável; valor validado com `validarValorReal`.
- `DELETE /api/occurrences/:id/pagar` → 200 `OcorrenciaPaga`.
- `GET /api/bills`: `ocorrencia_atual` passa a vir para **todas** as contas (fixas também),
  com `paid_at` e `paid_source`.
- `GET /api/occurrences/upcoming` passa a trazer `paid_at`.

## Lembretes

- `notificationMaterializer`: não cria lembrete para ocorrência com `paid_at`.
- `dispatcher.ts`: ocorrência paga → notificação `skipped`, sem envio (cobre o que já estava na fila).
- Mensagem do lembrete ganha no final: `Já pagou? Responda /paguei <nome da conta>`.
- Desmarcar não ressuscita lembrete já pulado; os dias seguintes voltam a ser criados.

## WhatsApp: `/paguei`

- `/paguei luz` (fixa) e `/paguei luz 187,40` ou `/paguei 187,40 luz` (variável). Valor
  aceita os mesmos formatos do `/gasto` (`45,90`, `1.234,56`, `R$45`).
- Casa o nome com as contas **ativas** do usuário, com a regra do `/marcar`: sem acento e
  maiúscula, nome exato ganha de trecho, empate pede o nome completo, nenhuma pede para
  conferir com `/contas`.
- Variável sem valor: não marca; responde `Luz é variável: manda /paguei luz 187,40`.
- Já paga: `Luz já estava paga em 05/10.`
- Sucesso: `✅ Luz paga (R$ 187,40, venc. 10/10).`
- Trava `command_reply` tomada antes de gravar e liberada se a gravação falhar (igual ao `/gasto`).
- `/contas` mostra `✅` nas contas pagas. `/ajuda` lista `/paguei luz 120 — marca uma conta como paga`.
- Parte pura (parse, escolha da conta, textos) em `whatsappCommands.ts`; banco em `whatsappCommandHandler.ts`.

## Interface

- `src/api/occurrences.ts`: `pagar(id, amount?)`, `desfazerPagamento(id)`.
- `src/types/index.ts`: `OcorrenciaAtual` ganha `paid_at`, `paid_source`; `BillOccurrence` ganha `paid_at?`.
- Card em `ContasLista.tsx` (conta ativa com `ocorrencia_atual`):
  - Em aberto: botão "Marcar como paga" (ícone `check_circle`, alvo ≥ 44px).
    Fixa: um toque marca; toast de sucesso. Variável: modal com `NumberField` preenchido
    (real se houver, senão a estimativa) e botão "Confirmar pagamento".
  - Paga: selo "Paga em 05/10" com ícone + texto (não só cor) e ação "Desfazer".
- Home: próximos vencimentos mostram check/"paga" nas pagas.

## Testes

Jest (backend, só funções puras): parse do `/paguei`, escolha da conta, textos de resposta,
✅ no `/contas`, linha nova do lembrete, decisão de pular lembrete de ocorrência paga
(extrair predicado puro se preciso). Vitest no frontend só se surgir função pura nova.
`npm run build` no backend e na raiz precisam passar.
