# Design: Normalização de Número de Telefone no Login

**Data:** 2026-05-15  
**Status:** Aprovado  
**Escopo:** Correção de perfis duplicados causados por variantes do número brasileiro (com/sem o dígito 9)

---

## Problema

O login via WhatsApp OTP aceita números brasileiros com e sem o dígito 9 após o DDD (ex: `5511987654321` e `55187654321`). Quando o WAHA está indisponível ou falha ao resolver o número, o fallback em `verify-otp` busca apenas pelo número exato digitado — sem tentar a variante. Isso cria um segundo usuário no banco para o mesmo número de WhatsApp.

### Causa Raiz

Em `backend/src/routes/auth.ts`, no endpoint `verify-otp`:

```ts
let resolvedNumber = digits
try {
  resolvedNumber = await resolveWhatsAppNumber(digits)
} catch {
  // silently falls back to digits
}

const [userRows]: any = await pool.query(
  `SELECT * FROM users WHERE whatsapp_number IN (?, ?) LIMIT 1`,
  [digits, resolvedNumber]  // quando WAHA falha: IN (digits, digits) — busca ineficaz
)
```

Quando a resolução via WAHA falha, `resolvedNumber = digits`, e o `IN` efetivamente busca por um único valor, sem considerar a variante com/sem 9.

---

## Solução (Opção A)

### Parte 1 — Fix em `verify-otp`

Após o bloco try/catch de resolução, sempre gerar a variante via `generatePhoneVariant` (função já existente em `waha.ts`, sem dependência do WAHA) e incluir todos os candidatos únicos na busca:

```ts
let resolvedNumber = digits
try {
  resolvedNumber = await resolveWhatsAppNumber(digits)
} catch { /* WAHA indisponível — usa fallback por variante */ }

const variant = generatePhoneVariant(digits)
const candidates = [...new Set([digits, resolvedNumber, ...(variant ? [variant] : [])])]

const [userRows]: any = await pool.query(
  `SELECT * FROM users WHERE whatsapp_number IN (${candidates.map(() => '?').join(',')}) LIMIT 1`,
  candidates
)
```

**Arquivo:** `backend/src/routes/auth.ts`  
**Importação adicional:** `generatePhoneVariant` de `../services/waha`

### Parte 2 — Migration `004_merge_duplicate_phones`

Adicionada em `backend/src/migrate.ts`, roda no startup via `runMigrations()`.

#### Tabela de controle de migrations

```sql
CREATE TABLE IF NOT EXISTS migration_log (
  name    VARCHAR(100) NOT NULL,
  ran_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (name)
)
```

Guard: se `migration_log` já contiver `004_merge_duplicate_phones`, a migration é pulada.

#### Lógica de mesclagem

Para cada par de usuários onde:
- Um tem 12 dígitos (sem 9), outro tem 13 dígitos (com 9)
- Os dígitos base (sem o 9) são idênticos

O usuário com `created_at` mais antigo é o **principal**. O mais novo é o **duplicado**.

Sequência de operações:
1. Se `duplicate_user` tem checklist e `older_user` também tem checklist → deleta o checklist do duplicado (e seus items/polls via CASCADE) antes do UPDATE
2. `UPDATE bills SET user_id = older WHERE user_id = duplicate`
3. `UPDATE notifications SET user_id = older WHERE user_id = duplicate`
4. `UPDATE checklists SET user_id = older WHERE user_id = duplicate` (FK única — já tratada no passo 1)
5. `UPDATE checklist_daily_polls SET user_id = older WHERE user_id = duplicate`
6. `UPDATE otp_codes SET phone_number = older_number WHERE phone_number = duplicate_number`
7. `DELETE FROM users WHERE id = duplicate`
8. Registra `004_merge_duplicate_phones` em `migration_log`

#### Idempotência

A migration só roda se `migration_log` não contiver o registro. Após a primeira execução bem-sucedida, futuras chamadas a `runMigrations()` são no-ops para essa migration.

---

## Arquivos Modificados

| Arquivo | Mudança |
|---|---|
| `backend/src/routes/auth.ts` | Adiciona `generatePhoneVariant` ao `IN` de busca de usuários |
| `backend/src/services/waha.ts` | Nenhuma alteração (função já existe) |
| `backend/src/migrate.ts` | Adiciona migration `004_merge_duplicate_phones` + tabela `migration_log` |

---

## Fora de Escopo

- Normalização do número em `request-otp` (OTP ainda é armazenado com o número bruto digitado; rate-limit ainda trata variantes como separadas)
- OTP cross-variant (pedir OTP com uma variante e verificar com outra ainda falha — raro na prática)
- Alteração de schema de `users.whatsapp_number`

---

## Critérios de Sucesso

- Login com `551189999999` e `55189999999` resulta no mesmo usuário, independente de WAHA estar disponível ou não
- Migration roda no startup sem erros em banco com ou sem duplicatas
- Migration é idempotente (segunda execução é no-op)
- Nenhum dado de contas/notificações/checklists é perdido na mesclagem
