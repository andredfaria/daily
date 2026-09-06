# Plano — KPIs de constância do checklist

## Contexto

O app BillSync tem uma tela `/checklists/analise` (`src/pages/checklists/ChecklistsAnalise.tsx`)
alimentada por `GET /api/checklists/dashboard` (`backend/src/routes/checklists.ts`).
O usuário quer acompanhar **constância**: quantas vezes marcou o checklist na
semana/mês, como isso compara com o período anterior, e quantos dias seguidos.

Fonte de dados: tabela `checklist_daily_polls`, uma linha por dia por checklist.

- `status ENUM('pending','sent','completed')` — `'sent'` = poll foi despachado;
  `'completed'` = usuário marcou 100% dos itens. Um poll despachado e ignorado
  fica em `'sent'` com `completed_count = 0`.
- `completed_count` — quantos itens o usuário marcou naquele dia.
- `completion_pct DECIMAL(5,2)` — percentual marcado.
- `poll_date DATE` — data em São Paulo.

## Global Constraints

1. **Todo código, comentário e mensagem de log em português (pt-BR).** É a
   convenção do repositório inteiro (CLAUDE.md).
2. **Lógica nova vai em função pura, testada sem banco e sem rede.** Backend:
   jest em `backend/src/services/__tests__/`. Frontend: vitest em
   `src/**/__tests__/`. É como `checklistStats.ts` já é feito.
3. **Não alterar o schema do banco.** Nenhuma migration. Tudo é calculado a
   partir das colunas que já existem.
4. **Definições acordadas com o usuário, que não se negociam:**
   - Denominador de qualquer janela é **dias em que o poll foi enviado**
     (`status IN ('sent','completed')`), não dias corridos. Um checklist de
     seg–sex não pode ser penalizado pelo sábado.
   - "Respondeu" no dia = `completed_count > 0`.
   - "Completou" no dia = `completion_pct >= 100`.
   - Janelas são **móveis e do mesmo tamanho**: semana = `hoje-6..hoje` contra
     `hoje-13..hoje-7`; mês = `hoje-29..hoje` contra `hoje-59..hoje-30`.
     Nada de semana de calendário.
   - Sequência conta **dias seguidos que respondeu** (≥1 item), percorrendo
     apenas os dias com poll enviado — dia sem poll não quebra nem conta.
   - **O dia de hoje nunca quebra a sequência**, só a estende. Sem isso o card
     zeraria toda manhã antes de o usuário responder o poll.
5. Comentários explicam *por que*, não *o que*. Densidade igual à do código ao
   redor.

## Contrato entre as tasks

A Task 1 produz e a Task 2 consome exatamente estes tipos. Os nomes de campo
são literais — o JSON da rota e o `src/types/index.ts` usam os mesmos.

```ts
export interface JanelaConstancia {
  dias_com_poll: number      // denominador: polls enviados na janela
  dias_respondidos: number   // completed_count > 0
  dias_completos: number     // completion_pct >= 100
}

export interface ComparativoConstancia {
  atual: JanelaConstancia
  anterior: JanelaConstancia
}

export interface ConstanciaChecklist {
  semana: ComparativoConstancia
  mes: ComparativoConstancia
  sequencia: { atual: number; melhor: number }
}
```

`GET /api/checklists/dashboard` passa a devolver o campo `constancia:
ConstanciaChecklist`. Quando o checklist não tem nenhum poll, devolve o objeto
com todos os números zerados — nunca `null`, para o front não precisar de
guarda.

---

## Task 1 — Backend: módulo puro `checklistConsistency.ts` + rota

### Arquivos

- criar `backend/src/services/checklistConsistency.ts`
- criar `backend/src/services/__tests__/checklistConsistency.test.ts`
- editar `backend/src/routes/checklists.ts` (handler `GET /dashboard`)

### O módulo

Exporta os tipos do "Contrato entre as tasks" acima, verbatim, e:

```ts
export interface PollResumo {
  poll_date: string        // 'YYYY-MM-DD'
  completed_count: number
  completion_pct: number
}

export function computeConsistency(
  polls: PollResumo[],   // só polls despachados, ordem cronológica crescente
  hoje: string,          // 'YYYY-MM-DD' em São Paulo
): ConstanciaChecklist
```

Regras:

- As quatro janelas são fatias de `polls` por intervalo de data, inclusive nas
  duas pontas. Cada janela conta `dias_com_poll` (quantos polls caíram nela),
  `dias_respondidos` e `dias_completos`.
- Sequência atual: percorre `polls` do mais recente para o mais antigo. Um poll
  com `completed_count > 0` soma 1; o primeiro poll com `completed_count === 0`
  encerra a contagem. **Exceção:** se o poll mais recente for de `hoje` e tiver
  `completed_count === 0`, ele é ignorado (não conta nem quebra) e a contagem
  segue a partir do anterior.
- Melhor sequência: a maior corrida de `completed_count > 0` em toda a série.
  Aqui o poll de hoje não respondido também é ignorado, pela mesma razão.
- Robustez de tipo: `completed_count` e `completion_pct` podem chegar do MySQL
  como string (`DECIMAL` vira string no mysql2). Normalize com `Number(...)`
  antes de comparar.
- `poll_date` pode chegar como `Date`; a rota normaliza para `'YYYY-MM-DD'`
  antes de chamar. O módulo assume string e não trata `Date`.

### A rota

O handler `GET /dashboard` já roda esta query para o streak por item:

```sql
SELECT selected_options
  FROM checklist_daily_polls
 WHERE checklist_id = ? AND status IN ('sent', 'completed')
 ORDER BY poll_date ASC
```

Acrescente `poll_date, completed_count, completion_pct` ao `SELECT` e reaproveite
o mesmo resultado para montar os `PollResumo`. **Nenhuma query nova.** O `hoje`
já existe no handler (`getTodaySaoPaulo()`).

Inclua `constancia` no `res.json({ ... })`.

### Testes (jest, `cd backend && npm test`)

Cubra, no mínimo:

- janela ignora dia sem poll: checklist seg–sex, sábado e domingo sem linha,
  `dias_com_poll` da semana é 5, não 7.
- comparativo: `atual` e `anterior` caem nas fatias certas; um poll de
  `hoje-7` entra em `anterior` e não em `atual`; `hoje-6` entra em `atual`.
- sequência atravessa fim de semana sem poll sem quebrar.
- poll de hoje com `completed_count = 0` não zera a sequência; o mesmo poll com
  data de ontem zera.
- `dias_completos` usa `completion_pct >= 100`, e um dia com 99.99 não conta.
- `completed_count`/`completion_pct` chegando como string do MySQL produzem o
  mesmo resultado que chegando como número.
- série vazia devolve tudo zerado, sem lançar.

---

## Task 2 — Frontend: card de constância + wiring

**Depende da Task 1** apenas pelo contrato de tipos, que já está escrito acima.

### Arquivos

- editar `src/types/index.ts` — acrescentar `JanelaConstancia`,
  `ComparativoConstancia`, `ConstanciaChecklist` (verbatim do contrato) e o
  campo `constancia: ConstanciaChecklist` em `ChecklistDashboardData`.
- criar `src/utils/constancia.ts` — helper puro de formatação do delta.
- criar `src/utils/__tests__/constancia.test.ts`
- criar `src/components/checklist/analise/ConstanciaCard.tsx`
- editar `src/pages/checklists/ChecklistsAnalise.tsx`

### Helper puro

```ts
export interface DeltaFormatado {
  texto: string                              // '+2', '−1', '0'  (menos é U+2212)
  direcao: 'subiu' | 'desceu' | 'igual'
}
export function formatarDelta(atual: number, anterior: number): DeltaFormatado
```

Testar: positivo, negativo, zero, e que o sinal de menos é o U+2212 (`−`), não
o hífen ASCII — é o mesmo cuidado tipográfico do resto do app.

### O card

`ConstanciaCard.tsx` recebe `{ constancia: ConstanciaChecklist }` e desenha:

```
Constância                              🔥 4 dias seguidos
                                           recorde: 11

              últimos 7 dias        últimos 30 dias
respondeu     5 de 6    ↗ +2        22 de 26   ↗ +3
completou     3 de 6    ↘ −1        14 de 26   → 0
```

- Mesmo invólucro dos outros blocos da tela:
  `glass-card rounded-2xl border border-outline-variant/50 p-6`, título em
  `text-base font-semibold text-on-surface mb-4`.
- Cor nunca é o único sinal: cada delta carrega seta (`↗ ↘ →`) além da cor.
  É a mesma regra que `WhatsAppProfileCard` segue no selo de número.
  Verde = `text-tertiary`, vermelho = `text-error`, neutro =
  `text-on-surface-variant`.
- A sequência usa o ícone `local_fire_department` em `text-orange-400`, que já
  é o ícone de sequência na tela.
- Mobile-first: as duas janelas empilham em telas estreitas
  (`grid-cols-1 sm:grid-cols-2`). Nada de scroll horizontal.
- Alvo de toque de 44px vale só para o que é clicável — o card não é.
- Estado vazio: quando `semana.atual.dias_com_poll === 0`, mostrar uma linha
  explicando que ainda não há poll enviado, em vez de "0 de 0".

### Wiring em `ChecklistsAnalise.tsx`

- Renderizar `<ConstanciaCard>` logo acima de `<WeeklyTrendSparkline>`, dentro
  do mesmo `space-y-6`. Só quando `dashboard?.constancia` existir.
- **Conserto junto:** o `StatCard` de label "Melhor Sequência" hoje calcula
  `itemStats.reduce((max, s) => Math.max(max, s.streak_current), 0)` — isso é a
  maior sequência *de um item qualquer*, não a do checklist, e o rótulo diz
  "melhor" enquanto o número é o atual. Troque para
  `constancia.sequencia.atual` com o label **"Sequência Atual"**. O recorde sai
  do StatCard (passa a viver no card novo) e a variável `melhorSequencia`, que
  fica sem uso, some.

### Testes (vitest, `npm test` na raiz)

`src/utils/__tests__/constancia.test.ts` cobre `formatarDelta`. O componente em
si não é testado — o repositório só testa função pura, e nenhum componente tem
teste hoje.
