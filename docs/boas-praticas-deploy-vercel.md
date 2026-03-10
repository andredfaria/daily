# Boas práticas para evitar erros de deploy na Vercel (Next.js)

Este guia foi criado para prevenir falhas como erro de variáveis de ambiente ausentes durante o `next build`, especialmente em integrações como Stripe.

## 1) Nunca inicialize SDKs sensíveis no topo do módulo

**Problema comum:** inicializar clientes (Stripe, banco, etc.) no import do arquivo, por exemplo:

- `const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)`

Durante o build da Vercel, o Next pode avaliar módulos de rotas/API para coletar metadados. Se a variável não existir naquele momento, o build quebra.

**Boa prática:** usar inicialização lazy (função `getClient()`), validando env apenas quando necessário na execução da rota.

## 2) Centralize validação de variáveis de ambiente

- Mantenha um módulo único para checar envs obrigatórias por domínio (ex.: `validateStripeEnvironment`).
- Faça fail-fast com mensagens claras de erro.
- Diferencie variáveis de servidor e cliente:
  - **Servidor (secretas):** sem `NEXT_PUBLIC_`
  - **Cliente (públicas):** com `NEXT_PUBLIC_`

## 3) Trate build e runtime como contextos diferentes

- **Build:** evite código com efeitos colaterais em nível de módulo.
- **Runtime:** só crie conexões/clientes quando a rota for chamada.
- Evite acessar banco, provedores externos e segredos no momento do import.

## 4) Checklist de variáveis no fluxo de release

Antes de promover para produção:

1. Conferir variáveis no painel da Vercel (Preview e Production).
2. Garantir que novos segredos foram adicionados em todos os ambientes.
3. Manter um `.env.example` atualizado (sem segredos reais).
4. Validar localmente com `npm run build`.

## 5) Mantenha rotas de pagamento resilientes

- Mensagens de erro claras para env faltante (`500` com contexto seguro).
- Não usar placeholders silenciosos para IDs de preço/produto.
- Validar autenticação e dados do usuário antes de chamar SDK externo.

## 6) Observabilidade mínima para incidentes

- Logar erro com prefixo por domínio (ex.: `[STRIPE CHECKOUT]`).
- Incluir etapa do fluxo no log (validação, criação customer, criação checkout).
- Não logar segredos/token/chaves.

## 7) Pipeline de qualidade recomendado

No CI (ou pré-merge), rodar:

- `npm ci`
- `npm run lint`
- `npm run build`

Opcional:

- Smoke test das rotas críticas (`/api/stripe/create-checkout-session`, webhooks).
- Verificação automática de env obrigatória por ambiente.

## 8) Estratégia para integrações externas (Stripe, Hotmart, WAHA)

- Encapsular cada integração em módulo próprio.
- Expor fábrica (`getXClient`) em vez de instância global imediata.
- Padronizar timeouts, retries e tratamento de erro.

## 9) Convenções de segurança

- Nunca expor `STRIPE_SECRET_KEY` no client.
- Revisar permissões e escopo de webhook secrets.
- Rotacionar chaves periodicamente e após incidentes.

## 10) Playbook rápido para erro de deploy por env

1. Ler stack trace e identificar módulo carregado no build.
2. Procurar inicialização top-level de SDK nesse módulo.
3. Refatorar para inicialização lazy.
4. Revalidar envs no painel Vercel.
5. Rodar `npm run build` local.
6. Fazer novo deploy.

---

## Resumo executivo

Se você aplicar apenas 3 ações, priorize estas:

1. **Lazy init de SDKs** (Stripe, DB, etc.).
2. **Validação centralizada de env** com erro explícito.
3. **Gate de CI com `npm run build`** antes de merge/deploy.
