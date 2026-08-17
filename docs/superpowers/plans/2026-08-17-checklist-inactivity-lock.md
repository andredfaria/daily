# Trava de Inatividade do Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parar de enviar a enquete do checklist (e, em cascata, os lembretes de contas) para usuários que ficam 15 dias seguidos sem votar, com caminho de reativação manual pelo site.

**Architecture:** Um contador incremental por checklist (`checklists.consecutive_misses`) é avaliado uma vez por dia, dentro do fluxo de envio diário já existente (`sendDailyPoll`), comparando o resultado do poll mais recente já encerrado. Ao atingir o limiar, o checklist é desativado; se todos os checklists ativos do usuário estiverem travados, o usuário inteiro é desativado (reaproveitando `users.is_active`, que já corta contas + checklist na lógica existente). Reativação é sempre uma ação explícita do usuário pelo site (endpoints já existentes, estendidos).

**Tech Stack:** Node.js/Express/TypeScript, MySQL2 (mysql), Jest/ts-jest (só para função pura), React/TypeScript/Tailwind (frontend).

## Global Constraints

- Todo texto, comentário e mensagem de log em **português (pt-BR)**.
- Sem suite de testes de integração/rota no projeto — só funções puras ganham teste Jest (padrão já estabelecido em `checklistStats.ts`/`checklistStats.test.ts`).
- Migrations reais vivem no array `MIGRATIONS` de `backend/src/migrate.ts` (não usar `backend/src/pending-migrations/`, que não é lido por `runMigrations()`).
- `.env` do backend aponta pro MySQL de produção real (`easypanel.eficienciia.com.br`) — qualquer verificação manual que crie dados de teste DEVE limpar tudo que criou (ideal: um usuário descartável cujo `DELETE` já casqueia tudo via `ON DELETE CASCADE`).
- Seguir os tokens de cor/espaçamento do design system em `design-system/billsync/MASTER.md` (ex.: `bg-error/10 border-error/30 text-error` para estados de alerta, já usado em `ChecklistCard.tsx`).
- Nunca usar emoji como ícone estrutural — usar Material Symbols Outlined.

---

### Task 1: Migration — coluna `consecutive_misses`

**Files:**
- Modify: `backend/src/migrate.ts:216-221` (após a entrada `011_users_monthly_summary`, antes do `]` que fecha `MIGRATIONS`)

**Interfaces:**
- Produces: coluna `checklists.consecutive_misses SMALLINT UNSIGNED NOT NULL DEFAULT 0`, usada pelas Tasks 3, 4 e 5.

- [ ] **Step 1: Adicionar a entrada de migration**

Em `backend/src/migrate.ts`, logo após o bloco:

```ts
  {
    name: '011_users_monthly_summary',
    run: async () => {
      await addColumnIfNotExists('users', 'monthly_summary_enabled', 'BOOLEAN NOT NULL DEFAULT TRUE', 'summary_day_of_week')
    },
  },
```

adicionar (antes do `]` de fechamento do array `MIGRATIONS`):

```ts
  {
    name: '012_checklists_consecutive_misses',
    run: async () => {
      await addColumnIfNotExists('checklists', 'consecutive_misses', 'SMALLINT UNSIGNED NOT NULL DEFAULT 0', 'is_active')
    },
  },
```

- [ ] **Step 2: Checar tipos**

Run: `cd backend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Rodar a migration contra o banco real e confirmar no log**

Run (em background, a partir de `backend/`):
```bash
cd backend && timeout 20 npm run dev 2>&1 | tee /tmp/migrate-check.log
```
Expected no log: linha `[migrate] 012_checklists_consecutive_misses concluida` e `[backend] running on port 4000`, sem nenhuma linha `[migrate] erro`. O comando encerra sozinho após 20s (timeout) — isso é esperado, não é falha.

Se a linha de sucesso não aparecer, rode `grep -i "012_checklists_consecutive_misses\|erro" /tmp/migrate-check.log` para ver o erro exato antes de prosseguir.

- [ ] **Step 4: Commit**

```bash
git add backend/src/migrate.ts
git commit -m "feat(checklist): adiciona coluna consecutive_misses em checklists"
```

---

### Task 2: Função pura `nextMissState`

**Files:**
- Create: `backend/src/services/checklistInactivity.ts`
- Test: `backend/src/services/__tests__/checklistInactivity.test.ts`

**Interfaces:**
- Produces: `nextMissState(previousMisses: number, lastCompletedCount: number, threshold?: number): { misses: number; shouldLock: boolean }`, consumida pela Task 3.

- [ ] **Step 1: Escrever o teste (deve falhar)**

Criar `backend/src/services/__tests__/checklistInactivity.test.ts`:

```ts
import { nextMissState } from '../checklistInactivity'

describe('nextMissState', () => {
  it('reseta para 0 quando o último poll teve alguma resposta', () => {
    expect(nextMissState(14, 1)).toEqual({ misses: 0, shouldLock: false })
    expect(nextMissState(20, 2)).toEqual({ misses: 0, shouldLock: false })
  })

  it('incrementa em 1 quando o último poll teve zero respostas', () => {
    expect(nextMissState(0, 0)).toEqual({ misses: 1, shouldLock: false })
    expect(nextMissState(5, 0)).toEqual({ misses: 6, shouldLock: false })
  })

  it('shouldLock é false um dia antes do limiar padrão (15)', () => {
    expect(nextMissState(13, 0)).toEqual({ misses: 14, shouldLock: false })
  })

  it('shouldLock é true exatamente no limiar padrão (15)', () => {
    expect(nextMissState(14, 0)).toEqual({ misses: 15, shouldLock: true })
  })

  it('respeita um threshold customizado', () => {
    expect(nextMissState(1, 0, 3)).toEqual({ misses: 2, shouldLock: false })
    expect(nextMissState(2, 0, 3)).toEqual({ misses: 3, shouldLock: true })
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd backend && npx jest checklistInactivity -v`
Expected: FAIL — `Cannot find module '../checklistInactivity'`.

- [ ] **Step 3: Implementar**

Criar `backend/src/services/checklistInactivity.ts`:

```ts
export interface MissState {
  misses: number
  shouldLock: boolean
}

// Dado o contador de dias seguidos sem resposta e o resultado do poll mais
// recente já encerrado, calcula o novo contador e se o limiar foi atingido.
export function nextMissState(
  previousMisses: number,
  lastCompletedCount: number,
  threshold = 15,
): MissState {
  const misses = lastCompletedCount > 0 ? 0 : previousMisses + 1
  return { misses, shouldLock: misses >= threshold }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `cd backend && npx jest checklistInactivity -v`
Expected: PASS (5 testes).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/checklistInactivity.ts backend/src/services/__tests__/checklistInactivity.test.ts
git commit -m "feat(checklist): adiciona nextMissState para trava de inatividade"
```

---

### Task 3: Orquestração — travar checklist/usuário em `sendDailyPoll`

**Depends on:** Task 1 (coluna no banco), Task 2 (`nextMissState`)

**Files:**
- Modify: `backend/src/services/checklistDispatcher.ts`

**Interfaces:**
- Consumes: `nextMissState` (Task 2); `sendWhatsAppText(phone: string, text: string): Promise<{ id: string | null }>` já exportado por `backend/src/services/waha.ts`.
- Produces: nenhuma interface nova consumida por outras tasks — efeito é só no banco (`checklists.is_active`, `checklists.consecutive_misses`, `users.is_active`).

- [ ] **Step 1: Importar as dependências novas**

Em `backend/src/services/checklistDispatcher.ts`, trocar a linha de import do topo:

```ts
import { sendWhatsAppPoll, WhatsAppNumberNotFoundError } from './waha'
```

por:

```ts
import { sendWhatsAppPoll, sendWhatsAppText, WhatsAppNumberNotFoundError } from './waha'
import { nextMissState } from './checklistInactivity'
```

- [ ] **Step 2: Adicionar a função `applyInactivityCheck`**

Logo abaixo de `getTodaySaoPaulo` (antes de `export async function sendDailyPoll`), adicionar:

```ts
const INACTIVITY_THRESHOLD = 15
const INACTIVITY_MESSAGE =
  'Notamos que você não responde ao checklist há 15 dias, então pausamos os lembretes por WhatsApp (checklist e contas). Quando quiser voltar, reative em Configurações no BillSync.'

// Verifica o resultado do poll mais recente já encerrado (poll_date < hoje) e
// atualiza o contador de dias seguidos sem resposta. Se o limiar for atingido,
// trava o checklist e, se for o último checklist ativo do usuário, trava o
// usuário inteiro (corta contas + checklist) e avisa por WhatsApp uma única vez.
// Retorna true se o checklist foi travado agora (o envio de hoje deve ser pulado).
async function applyInactivityCheck(checklistId: string, userId: string, today: string): Promise<boolean> {
  const [lastPollRows]: any = await pool.query(
    'SELECT completed_count FROM checklist_daily_polls WHERE checklist_id = ? AND poll_date < ? ORDER BY poll_date DESC LIMIT 1',
    [checklistId, today],
  )
  if (!lastPollRows.length) return false

  const [checklistRows]: any = await pool.query(
    'SELECT consecutive_misses FROM checklists WHERE id = ?',
    [checklistId],
  )
  if (!checklistRows.length) return false

  const { misses, shouldLock } = nextMissState(
    Number(checklistRows[0].consecutive_misses),
    Number(lastPollRows[0].completed_count),
    INACTIVITY_THRESHOLD,
  )

  await pool.query('UPDATE checklists SET consecutive_misses = ? WHERE id = ?', [misses, checklistId])

  if (!shouldLock) return false

  await pool.query('UPDATE checklists SET is_active = 0 WHERE id = ?', [checklistId])
  console.log(`[checklistDispatcher] checklist ${checklistId} travado por inatividade (${misses} dias sem resposta)`)

  const [remainingRows]: any = await pool.query(
    'SELECT COUNT(*) AS cnt FROM checklists WHERE user_id = ? AND is_active = 1 AND consecutive_misses < ?',
    [userId, INACTIVITY_THRESHOLD],
  )
  if (remainingRows[0].cnt > 0) return true

  const [userRows]: any = await pool.query('SELECT whatsapp_number FROM users WHERE id = ?', [userId])
  await pool.query('UPDATE users SET is_active = 0 WHERE id = ?', [userId])
  console.log(`[checklistDispatcher] usuário ${userId} desativado — todos os checklists travados por inatividade`)

  const phone = userRows[0]?.whatsapp_number
  if (phone) {
    try {
      await sendWhatsAppText(phone, INACTIVITY_MESSAGE)
    } catch (err: any) {
      console.error(`[checklistDispatcher] erro ao enviar aviso de pausa:`, err.message)
    }
  }

  return true
}
```

- [ ] **Step 3: Chamar a checagem no ponto certo de `sendDailyPoll`**

Dentro de `sendDailyPoll`, o bloco atual é:

```ts
    if (!opts.force) {
      const [existingRows]: any = await pool.query(
        'SELECT id FROM checklist_daily_polls WHERE checklist_id = ? AND poll_date = ?',
        [checklistId, today],
      )
      if (existingRows.length) {
        console.log(`[checklistDispatcher] poll já enviado hoje (checklist ${checklistId})`)
        return
      }
    } else {
```

Trocar por:

```ts
    if (!opts.force) {
      const [existingRows]: any = await pool.query(
        'SELECT id FROM checklist_daily_polls WHERE checklist_id = ? AND poll_date = ?',
        [checklistId, today],
      )
      if (existingRows.length) {
        console.log(`[checklistDispatcher] poll já enviado hoje (checklist ${checklistId})`)
        return
      }

      // Avalia a trava de inatividade só na primeira tentativa natural do dia
      // (force=true é reenvio manual/teste e não deve mexer no contador, senão
      // um duplo clique em "enviar agora" incrementaria o contador duas vezes).
      const locked = await applyInactivityCheck(checklistId, userId, today)
      if (locked) return
    } else {
```

(o resto do bloco `else { ... }` continua igual, sem mudança)

- [ ] **Step 4: Checar tipos**

Run: `cd backend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Verificação manual contra o banco real (com limpeza garantida)**

Criar um script descartável `backend/src/scripts/tmp-verify-inactivity.ts` (não vai ser commitado):

```ts
import { v4 as uuidv4 } from 'uuid'
import pool from '../db'
import { sendDailyPoll } from '../services/checklistDispatcher'

async function main() {
  const userId = uuidv4()
  const checklistId = uuidv4()
  const phone = '99' + Date.now().toString().slice(-11)

  try {
    await pool.query(
      `INSERT INTO users (id, name, whatsapp_number, is_active) VALUES (?, 'TEMP TESTE INATIVIDADE', ?, 1)`,
      [userId, phone],
    )
    await pool.query(
      `INSERT INTO checklists (id, user_id, name, send_time, is_active) VALUES (?, ?, 'TEMP TESTE INATIVIDADE', 9, 1)`,
      [checklistId, userId],
    )
    await pool.query(
      `INSERT INTO checklist_items (id, checklist_id, text, sort_order) VALUES (UUID(), ?, 'Item A', 0), (UUID(), ?, 'Item B', 1)`,
      [checklistId, checklistId],
    )
    for (let i = 15; i >= 1; i--) {
      await pool.query(
        `INSERT INTO checklist_daily_polls (id, checklist_id, user_id, poll_date, completed_count, total_count, status)
         VALUES (UUID(), ?, ?, DATE_SUB(CURDATE(), INTERVAL ? DAY), 0, 2, 'sent')`,
        [checklistId, userId, i],
      )
    }

    await sendDailyPoll(checklistId, userId, {})

    const [[checklist]]: any = await pool.query(
      'SELECT is_active, consecutive_misses FROM checklists WHERE id = ?',
      [checklistId],
    )
    const [[user]]: any = await pool.query('SELECT is_active FROM users WHERE id = ?', [userId])

    console.log('checklist após 15 dias sem resposta:', checklist)
    console.log('usuário após checklist travar:', user)

    if (Number(checklist.is_active) !== 0) throw new Error('FALHA: checklist deveria estar is_active=0')
    if (Number(checklist.consecutive_misses) < 15) throw new Error('FALHA: consecutive_misses deveria ser >= 15')
    if (Number(user.is_active) !== 0) throw new Error('FALHA: usuário deveria estar is_active=0 (único checklist travado)')

    console.log('OK: trava de inatividade funcionou como esperado.')
  } finally {
    await pool.query('DELETE FROM users WHERE id = ?', [userId])
    console.log('limpeza concluída (usuário e dados em cascata removidos).')
  }

  process.exit(0)
}

main().catch((err) => {
  console.error('ERRO NA VERIFICAÇÃO:', err.message)
  process.exit(1)
})
```

Run: `cd backend && npx ts-node src/scripts/tmp-verify-inactivity.ts`
Expected: as duas linhas de log dos objetos, seguidas de `OK: trava de inatividade funcionou como esperado.` e `limpeza concluída...`. Se cair no `catch` de erro, o `finally` ainda limpa os dados — mas investigue a causa antes de prosseguir.

Depois de confirmar o `OK`, apagar o script (ele não é parte do código do produto):
```bash
rm backend/src/scripts/tmp-verify-inactivity.ts
rmdir backend/src/scripts 2>/dev/null || true
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/checklistDispatcher.ts
git commit -m "feat(checklist): trava checklist e usuario apos 15 dias sem resposta"
```

---

### Task 4: Reativação de checklist individual (backend)

**Depends on:** Task 1

**Files:**
- Modify: `backend/src/routes/checklists.ts:107-159` (rota `PUT /:id`)
- Modify: `backend/src/routes/checklists.ts:181-198` (rota `DELETE /:id/history`)

**Interfaces:**
- Produces: `PUT /api/checklists/:id` aceita `is_active?: boolean` no corpo; reativar (`true`) zera `consecutive_misses`. `DELETE /api/checklists/:id/history` também zera `consecutive_misses`. Consumido pela Task 6.

- [ ] **Step 1: Aceitar `is_active` em `PUT /:id`**

Em `backend/src/routes/checklists.ts`, dentro de `router.put('/:id', ...)`, trocar:

```ts
    const { name, send_time, timezone, recurrence_type, recurrence_days, items } = req.body
```

por:

```ts
    const { name, send_time, timezone, recurrence_type, recurrence_days, items, is_active } = req.body
```

E logo após o bloco existente:

```ts
    if (recurrence_days !== undefined) { updates.push('recurrence_days = ?'); values.push(JSON.stringify(recurrence_days)) }
```

adicionar:

```ts
    if (is_active !== undefined) {
      updates.push('is_active = ?')
      values.push(is_active ? 1 : 0)
      if (is_active) {
        // Reativação manual: recomeça a contagem de dias sem resposta do zero.
        updates.push('consecutive_misses = 0')
      }
    }
```

- [ ] **Step 2: Zerar o contador ao limpar histórico**

Em `router.delete('/:id/history', ...)`, trocar:

```ts
    const [result]: any = await pool.query(
      'DELETE FROM checklist_daily_polls WHERE checklist_id = ?',
      [req.params.id],
    )
    res.json({ deleted: result.affectedRows ?? 0 })
```

por:

```ts
    const [result]: any = await pool.query(
      'DELETE FROM checklist_daily_polls WHERE checklist_id = ?',
      [req.params.id],
    )
    await pool.query('UPDATE checklists SET consecutive_misses = 0 WHERE id = ?', [req.params.id])
    res.json({ deleted: result.affectedRows ?? 0 })
```

- [ ] **Step 3: Checar tipos**

Run: `cd backend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/checklists.ts
git commit -m "feat(checklist): permite reativar checklist travado por inatividade"
```

---

### Task 5: Reativação do usuário em cascata (backend)

**Depends on:** Task 1

**Files:**
- Modify: `backend/src/routes/users.ts:20-111` (rota `PATCH /me`)

**Interfaces:**
- Produces: `PATCH /api/users/me` com `{ is_active: true }`, quando o usuário estava `is_active=false`, também zera `consecutive_misses` de todos os checklists dele. Consumido pela Task 7.

- [ ] **Step 1: Detectar a transição de reativação antes do UPDATE**

Em `backend/src/routes/users.ts`, dentro de `router.patch('/me', ...)`, logo após:

```ts
    const fields: string[] = []
    const values: any[] = []
```

adicionar:

```ts
    let reactivating = false
    if (req.body.is_active === true) {
      const [[current]]: any = await pool.query('SELECT is_active FROM users WHERE id = ?', [req.userId])
      reactivating = !!current && !current.is_active
    }
```

- [ ] **Step 2: Zerar os contadores dos checklists após o UPDATE principal**

Trocar:

```ts
    if (fields.length) {
      fields.push('updated_at = ?')
      values.push(new Date())
      values.push(req.userId)
      await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values)
    }

    const [rows]: any = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [req.userId])
    res.json(rows[0])
```

por:

```ts
    if (fields.length) {
      fields.push('updated_at = ?')
      values.push(new Date())
      values.push(req.userId)
      await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values)
    }

    if (reactivating) {
      // Dá 15 dias novos de chance a cada checklist, em vez de reativar o
      // usuário só para ele ser travado de novo no próximo dia por causa do
      // histórico antigo de dias sem resposta.
      await pool.query('UPDATE checklists SET consecutive_misses = 0 WHERE user_id = ?', [req.userId])
    }

    const [rows]: any = await pool.query('SELECT * FROM users WHERE id = ? LIMIT 1', [req.userId])
    res.json(rows[0])
```

- [ ] **Step 3: Checar tipos**

Run: `cd backend && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/users.ts
git commit -m "feat(checklist): zera contadores de inatividade ao reativar usuario"
```

---

### Task 6: Reativar checklist individual (frontend)

**Depends on:** Task 4

**Files:**
- Modify: `src/api/checklists.ts` (tipo `UpdateChecklistPayload`)
- Modify: `src/components/checklist/ChecklistCard.tsx`
- Modify: `src/pages/Checklists.tsx`

**Interfaces:**
- Consumes: `PUT /api/checklists/:id { is_active }` (Task 4).
- Produces: nenhuma interface nova consumida por outra task.

- [ ] **Step 1: Adicionar `is_active` ao payload de update**

Em `src/api/checklists.ts`, trocar:

```ts
export interface UpdateChecklistPayload {
  name?: string
  send_time?: number
  timezone?: string
  recurrence_type?: ChecklistRecurrenceType
  recurrence_days?: number[] | null
  items?: { text: string }[]
}
```

por:

```ts
export interface UpdateChecklistPayload {
  name?: string
  send_time?: number
  timezone?: string
  recurrence_type?: ChecklistRecurrenceType
  recurrence_days?: number[] | null
  items?: { text: string }[]
  is_active?: boolean
}
```

- [ ] **Step 2: Badge + botão de reativar no card**

Em `src/components/checklist/ChecklistCard.tsx`, adicionar `onReactivate` às props:

```ts
interface ChecklistCardProps {
  checklist: Checklist
  stats?: ChecklistStatsEntry
  onEdit: (c: Checklist) => void
  onDelete: (c: Checklist) => void
  onClearHistory: (c: Checklist) => void
  onSendNow: (c: Checklist) => void
  onReactivate: (c: Checklist) => void
  sending: boolean
}
```

Atualizar a assinatura do componente:

```ts
export const ChecklistCard: React.FC<ChecklistCardProps> = ({ checklist, stats, onEdit, onDelete, onClearHistory, onSendNow, onReactivate, sending }) => {
```

Logo após o fechamento da `<div className="flex items-start justify-between gap-3 mb-3">` (antes da `<div className="flex items-center justify-around py-3 mb-3 ...">` das mini-stats), adicionar:

```tsx
      {!checklist.is_active && (
        <div className="flex items-center justify-between gap-2 mb-3 px-3 py-2 rounded-xl bg-error/10 border border-error/30">
          <span className="flex items-center gap-1.5 text-xs text-error">
            <span className="material-symbols-outlined text-sm">pause_circle</span>
            Pausado por inatividade
          </span>
          <button
            onClick={() => onReactivate(checklist)}
            className="text-xs font-semibold text-error hover:text-error/80 transition-colors"
          >
            Reativar
          </button>
        </div>
      )}
```

- [ ] **Step 3: Handler e wiring em `Checklists.tsx`**

Em `src/pages/Checklists.tsx`, logo após `handleSendNow` (antes do comentário `// -------- Loading state --------`), adicionar:

```ts
  // -------- Reactivate --------
  const handleReactivateChecklist = async (c: Checklist) => {
    try {
      await checklistsApi.update(c.id, { is_active: true })
      success('Checklist reativado!')
      await fetchData()
    } catch {
      showError('Erro ao reativar checklist.')
    }
  }
```

E no JSX, trocar:

```tsx
              <ChecklistCard
                key={c.id}
                checklist={c}
                stats={statsMap.get(c.id)}
                onEdit={openEdit}
                onDelete={setDeleteTarget}
                onClearHistory={setClearHistoryTarget}
                onSendNow={(cl) => handleSendNow(cl, false)}
                sending={sendingId === c.id}
              />
```

por:

```tsx
              <ChecklistCard
                key={c.id}
                checklist={c}
                stats={statsMap.get(c.id)}
                onEdit={openEdit}
                onDelete={setDeleteTarget}
                onClearHistory={setClearHistoryTarget}
                onSendNow={(cl) => handleSendNow(cl, false)}
                onReactivate={handleReactivateChecklist}
                sending={sendingId === c.id}
              />
```

- [ ] **Step 4: Checar tipos e build**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/api/checklists.ts src/components/checklist/ChecklistCard.tsx src/pages/Checklists.tsx
git commit -m "feat(checklist): permite reativar checklist pausado por inatividade no app"
```

---

### Task 7: Banner de reativação da conta (frontend)

**Depends on:** Task 5

**Files:**
- Modify: `src/pages/Configuracoes.tsx`

**Interfaces:**
- Consumes: `PATCH /api/users/me { is_active }` (Task 5), `User.is_active` (já existe em `src/types/index.ts:92`).

- [ ] **Step 1: Estado e handler de reativação**

Em `src/pages/Configuracoes.tsx`, logo após a declaração de `const [dispatchResult, ...]` (antes de `const { success, error: showError } = useToast()`), adicionar:

```ts
  const [reactivatingAccount, setReactivatingAccount] = useState(false)
```

Logo após `handleDispatch` (antes de `return (`), adicionar:

```ts
  const handleReactivateAccount = async () => {
    setReactivatingAccount(true)
    try {
      await client.patch('/users/me', { is_active: true })
      setUser((prev) => (prev ? { ...prev, is_active: true } : prev))
      success('Conta reativada! Você voltará a receber lembretes por WhatsApp.')
    } catch {
      showError('Erro ao reativar conta.')
    } finally {
      setReactivatingAccount(false)
    }
  }
```

- [ ] **Step 2: Banner no topo da página**

Trocar:

```tsx
  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="grid grid-cols-12 gap-6">
```

por:

```tsx
  return (
    <div className="space-y-6 animate-fadeIn">
      {user && !user.is_active && (
        <div className="rounded-2xl border border-error/30 bg-error/10 p-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-error">pause_circle</span>
            <div>
              <p className="text-sm font-semibold text-on-surface">Seus lembretes por WhatsApp estão pausados</p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Pausamos automaticamente por falta de resposta ao checklist. Reative quando quiser voltar a receber lembretes.
              </p>
            </div>
          </div>
          <button
            onClick={handleReactivateAccount}
            disabled={reactivatingAccount}
            className="btn-primary flex-shrink-0"
          >
            {reactivatingAccount ? 'Reativando...' : 'Reativar'}
          </button>
        </div>
      )}
      <div className="grid grid-cols-12 gap-6">
```

- [ ] **Step 3: Checar tipos e build**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Configuracoes.tsx
git commit -m "feat(checklist): banner de reativacao de conta pausada por inatividade"
```

---

## Verificação final (após todas as tasks)

- [ ] `cd backend && npx tsc --noEmit` limpo
- [ ] `npx tsc --noEmit` (frontend) limpo
- [ ] `cd backend && npx jest` — todos os testes passam, incluindo `checklistInactivity.test.ts`
- [ ] `npm run build` (frontend) sem erros
- [ ] Nenhum arquivo `backend/src/scripts/tmp-verify-inactivity.ts` sobrando no working tree
