# Plano de Ação — Bugs e Funcionalidades Quebradas
**DailySync | Gerado em 14/03/2026**

---

## Status Geral

| Categoria | Qtd | Status |
|-----------|-----|--------|
| Quebrado / Não funciona | 5 | 🔴 Crítico |
| Incompleto / Comportamento errado | 4 | 🟡 Alto |
| Segurança / Dados expostos | 3 | 🟠 Médio |
| Performance / UX | 2 | 🟢 Baixo |

---

## O que está funcionando

- Autenticação JWT (login, register, logout, middleware de rotas)
- Validação de telefone via WAHA no cadastro e edição
- Controle de acesso admin vs. usuário comum
- Webhooks Stripe (verificação de assinatura + atualização de status)
- CRUD de usuários (listagem, edição, deleção)
- Dashboard com KPIs e heatmap
- Paginação de usuários no painel admin
- Pool de conexões MySQL
- Queries parametrizadas (sem SQL injection)
- Token de reset gerado e salvo corretamente no banco

---

## O que está quebrado

---

### BUG 1 — `🔴 CRÍTICO` | API de reset de senha não existe

**Impacto:** Fluxo de recuperação de senha completamente quebrado

**O problema:**
O `ResetPasswordForm.tsx:64` chama `fetch('/api/auth/reset-password', ...)`, mas essa rota **não existe**. A pasta `app/api/auth/` contém apenas: `login`, `logout`, `me`, `register`, `forgot-password`, `verify`. O usuário clica em "Redefinir senha" e recebe erro 404.

**Arquivo:** `components/ResetPasswordForm.tsx:64`
```
fetch('/api/auth/reset-password', { method: 'POST', body: { token, password } })
```

**Solução:**
Criar `app/api/auth/reset-password/route.ts` com a lógica:
1. Receber `{ token, password }` do body
2. Chamar `getUserByResetToken(token)` — já existe em `lib/db/daily_user.ts:137`
3. Se não encontrar ou token expirado → 400
4. Hash da nova senha com bcryptjs
5. Chamar `updateUserPassword(user.id, hash)` — já existe em `lib/db/daily_user.ts:119`
6. Chamar `clearResetToken(user.id)` — já existe em `lib/db/daily_user.ts:130`
7. Retornar 200

Todas as funções de banco já estão implementadas. Falta apenas a rota da API.

---

### BUG 2 — `🔴 CRÍTICO` | Email de recuperação não é enviado

**Impacto:** Usuário solicita reset, não recebe nada. Funcionalidade inutil.

**O problema:**
`app/api/auth/forgot-password/route.ts:37`:
```ts
console.log(`[RESET PASSWORD] Link para ${email}: ${resetLink}`)
// TODO: integrar com serviço de envio de email
```
O token é salvo no banco corretamente, mas o link só aparece no console do servidor.

**Solução:**
Integrar um serviço de email transacional. Recomendação: **Resend** (mais simples para Next.js).

1. Instalar: `npm install resend`
2. Adicionar `RESEND_API_KEY` nas variáveis de ambiente
3. Substituir o `console.log` pelo envio real:
```ts
// Em forgot-password/route.ts, substituir console.log por:
const resend = new Resend(process.env.RESEND_API_KEY)
await resend.emails.send({
  from: 'noreply@seudominio.com',
  to: email,
  subject: 'Redefinição de senha — DailySync',
  html: `<p>Clique no link para redefinir sua senha:</p><a href="${resetLink}">${resetLink}</a><p>O link expira em 1 hora.</p>`,
})
```

---

### BUG 3 — `🔴 CRÍTICO` | `password_hash` exposto nas respostas da API

**Impacto:** Hash bcrypt enviado para o cliente em múltiplos endpoints

**O problema:**
`getDailyUserById` usa `SELECT *`, incluindo `password_hash`. A rota `/api/auth/me` retorna:
```ts
// app/api/auth/me/route.ts:32
return NextResponse.json({
  user: { id, phone, email, is_admin },
  dailyUser: user,  // ← user aqui inclui password_hash!
})
```
O mesmo ocorre em `GET /api/users/[id]` (linha 35) e na listagem de usuários.

**Solução:**
Em `lib/db/daily_user.ts`, trocar `SELECT *` por campos explícitos em todas as funções de leitura:
```sql
SELECT id, created_at, name, email, phone, title, option, time_to_send,
       is_admin, subscription_status, trial_ends_at, subscription_ends_at,
       subscription_plan, payment_provider, payment_customer_id,
       payment_subscription_id, payment_status, next_billing_date
FROM daily_user WHERE id = ? LIMIT 1
```
Aplicar em: `getDailyUserById`, `getDailyUserByEmail`, `getDailyUserByPhone`, `listDailyUsers`.
Manter `password_hash` apenas em `getDailyUserByPhone`/`getDailyUserByEmail` quando usadas para **autenticação** (login/forgot-password), não para exibição.

---

### BUG 4 — `🔴 CRÍTICO` | Webhook Hotmart retorna HTTP 200 em erros internos

**Impacto:** Falhas de pagamento silenciosas — Hotmart não faz retry, status de assinatura não é atualizado

**O problema:**
`app/api/webhooks/hotmart/route.ts:105-111`:
```ts
} catch (error) {
  return NextResponse.json(
    { error: 'Erro ao processar webhook' },
    { status: 200 }  // ← deveria ser 500!
  )
}
```
Quando o banco falha ou qualquer exceção ocorre, o webhook responde 200 OK. A Hotmart interpreta como sucesso e **não reenvia o evento**. Pagamentos aprovados podem não ativar assinaturas.

**Solução:**
Mudar status do catch para 500:
```ts
return NextResponse.json(
  { error: 'Erro ao processar webhook' },
  { status: 500 }  // Hotmart vai fazer retry automaticamente
)
```

---

### BUG 5 — `🔴 CRÍTICO` | Hotmart não acha usuário sem email

**Impacto:** Webhook Hotmart não ativa assinatura para usuários cadastrados só com telefone

**O problema:**
`app/api/webhooks/hotmart/route.ts:58`:
```ts
const dailyUser = await getDailyUserByEmail(buyerEmail)
```
O email é **opcional** no cadastro (`app/api/auth/register/route.ts`). Se o usuário criou conta só com telefone, `email = null` no banco. O webhook recebe o email de compra da Hotmart, não acha o usuário, e retorna:
```json
{ "message": "Usuário não encontrado, mas webhook processado" }
```
A assinatura nunca é ativada.

**Solução:**
Após não encontrar por email, tentar busca por `payment_customer_id` ou criar o usuário se necessário. Curto prazo: **obrigar email no cadastro** ou adicionar um campo de "email de pagamento" no perfil do usuário para vinculação manual.

Solução mínima no webhook:
```ts
let dailyUser = await getDailyUserByEmail(buyerEmail)
if (!dailyUser) {
  // Logar e retornar 200 para não causar retry desnecessário
  // mas registrar em uma tabela de eventos pendentes para processamento manual
  console.error('[HOTMART] Usuário não encontrado para email:', buyerEmail)
  return NextResponse.json({ message: 'Usuário não encontrado' }, { status: 200 })
}
```
Solução real: criar tabela `webhook_events_pending` para reprocessamento.

---

### BUG 6 — `🟡 ALTO` | JWT não é renovado após mudança de telefone

**Impacto:** Session cookie fica com telefone antigo após update — inconsistência de dados

**O problema:**
`PUT /api/users/[id]` atualiza o telefone no banco, mas o cookie JWT permanece com o `phone` antigo (payload imutável até expirar em 7 dias). O middleware e outros endpoints que lêem `session.phone` do JWT operam com dado desatualizado.

**Solução:**
Ao final do PUT, se `phone` foi alterado, regenerar e setar novo cookie:
```ts
// Após updateDailyUser(targetUserId, updateData):
if (updateData.phone && session.userId === targetUserId) {
  // Renovar token com novo phone
  const newToken = await signJWT({
    userId: session.userId,
    phone: updateData.phone as string,
    email: session.email,
    isAdmin: session.isAdmin,
  })
  await setSessionCookie(newToken)
}
```

---

### BUG 7 — `🟡 ALTO` | `daily-data` sem paginação — carrega tudo

**Impacto:** Usuários com histórico longo travam o browser e sobrecarregam o banco

**O problema:**
`app/api/daily-data/route.ts:39`:
```sql
SELECT * FROM daily_data WHERE id_user = ? ORDER BY activity_date DESC
```
Sem `LIMIT` ou `OFFSET`. Um usuário com 2 anos de histórico diário (730 registros) envia tudo de uma vez.

**Solução:**
Adicionar parâmetros de paginação:
```ts
const page = parseInt(searchParams.get('page') ?? '1')
const limit = Math.min(parseInt(searchParams.get('limit') ?? '90'), 365)
const offset = (page - 1) * limit

const activities = await query<DailyData>(
  `SELECT * FROM daily_data WHERE id_user = ? ORDER BY ${orderBy} ${orderDir} LIMIT ? OFFSET ?`,
  [targetUserId, limit, offset]
)
```

---

### BUG 8 — `🟡 ALTO` | Comparação de token Hotmart vulnerável a timing attack

**Impacto:** Segurança — atacante pode forjar tokens via análise de tempo de resposta

**O problema:**
`lib/hotmart.ts:39`:
```ts
return token === configuredToken  // comparação direta
```
Comparação de strings com `===` em JavaScript termina ao encontrar o primeiro caractere diferente. Isso permite inferir o token via timing.

**Solução:**
Usar `crypto.timingSafeEqual`:
```ts
import crypto from 'crypto'

const a = Buffer.from(token)
const b = Buffer.from(configuredToken)
if (a.length !== b.length) return false
return crypto.timingSafeEqual(a, b)
```

---

### BUG 9 — `🟠 MÉDIO` | `password_hash` incluso na resposta de listagem de usuários

**Impacto:** Admin que acessa `/api/users` recebe hashes de todos os usuários

**O problema:**
`listDailyUsers` em `lib/db/daily_user.ts:225` usa `SELECT *`. A rota `GET /api/users` retorna isso para o admin.

**Solução:** Idêntica ao Bug 3 — usar SELECT com campos explícitos em `listDailyUsers`.

---

### BUG 10 — `🟠 MÉDIO` | Campo `option` com formato inconsistente

**Impacto:** Crash ou exibição incorreta das opções de enquete no dashboard

**O problema:**
O campo `option` no banco pode estar como:
- `NULL`
- `'["item1","item2"]'` (JSON array serializado — formato correto)
- `'{"checklist":["item1"]}'` (formato legado objeto)
- Dados não parseáveis

O parsing no frontend tenta múltiplos formatos mas pode falhar silenciosamente.

**Solução:**
1. Criar utilitário centralizado `parseOption(raw: string | null): string[]`
2. Adicionar migration para normalizar dados existentes no banco para o formato array JSON
3. Validar e serializar sempre no momento de salvar (INSERT/UPDATE)

---

### BUG 11 — `🟠 MÉDIO` | Sem rate limiting no endpoint de forgot-password

**Impacto:** Atacante pode enumerar emails ou spammar usuários com reset links

**O problema:**
`POST /api/auth/forgot-password` não tem rate limiting. Qualquer IP pode fazer milhares de requests tentando emails.

**Solução:**
Aplicar o rate limiter já existente no projeto:
```ts
// app/api/auth/forgot-password/route.ts
import { createStrictRateLimiter } from '@/lib/middleware/rateLimit'
const rateLimiter = createStrictRateLimiter() // 10 req/min

export async function POST(request: NextRequest) {
  const rateLimitResult = await rateLimiter(request)
  if (rateLimitResult) return rateLimitResult
  // ... resto do handler
}
```

---

### BUG 12 — `🟢 BAIXO` | Middleware de rotas usa `startsWith` — risco futuro

**Impacto:** Baixo agora, mas futuras rotas como `/login-oauth` não seriam protegidas corretamente

**O problema:**
`middleware.ts` verifica rotas públicas com `.startsWith('/login')`. Se criar `/login-callback` ou `/logout-confirm`, o comportamento seria incorreto.

**Solução:**
Usar array de rotas exatas ou regex mais preciso:
```ts
const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password', '/']
const isPublic = publicPaths.some(path =>
  request.nextUrl.pathname === path ||
  request.nextUrl.pathname.startsWith(path + '/')
)
```

---

## Resumo — Ordem de Execução

| Prioridade | Bug | Esforço | Impacto |
|-----------|-----|---------|---------|
| 1 | Bug 1 — Criar rota `/api/auth/reset-password` | Baixo (2h) | Recuperação de senha funciona |
| 2 | Bug 4 — Hotmart webhook status 500 no catch | Muito Baixo (5min) | Pagamentos não são perdidos |
| 3 | Bug 3 + 9 — Remover `password_hash` das respostas | Baixo (1h) | Segurança de dados |
| 4 | Bug 2 — Integrar Resend para envio de email | Médio (3h) | Reset de senha funciona de ponta a ponta |
| 5 | Bug 7 — Paginação em `/api/daily-data` | Baixo (1h) | Performance com dados reais |
| 6 | Bug 6 — Renovar JWT após troca de telefone | Baixo (1h) | Consistência de sessão |
| 7 | Bug 8 — `timingSafeEqual` no Hotmart | Muito Baixo (15min) | Segurança criptográfica |
| 8 | Bug 5 — Hotmart sem usuário por email | Médio (3h) | Conversão de pagamento |
| 9 | Bug 11 — Rate limit no forgot-password | Muito Baixo (15min) | Proteção contra abuso |
| 10 | Bug 10 — Normalizar campo `option` | Alto (4h + migration) | Estabilidade de dados |
| 11 | Bug 12 — Middleware regex de rotas | Muito Baixo (15min) | Segurança preventiva |

**Tempo total estimado: ~16 horas de desenvolvimento**

---

## Variáveis de Ambiente Faltando

Para que o sistema funcione completamente em produção, adicionar:

```env
# Email transacional (necessário para Bug 2)
RESEND_API_KEY=re_xxxxxxxxxxxx

# URL pública do app (para montar link de reset)
NEXT_PUBLIC_APP_URL=https://seudominio.com
```

---

*Documento gerado por auditoria estática em 14/03/2026.*
*Atualizar conforme os bugs forem corrigidos.*
