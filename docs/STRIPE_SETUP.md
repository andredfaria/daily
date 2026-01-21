# Guia de Configuração do Stripe

Este documento descreve como configurar o Stripe para processamento de pagamentos recorrentes no sistema Daily.

## 1. Criar Conta no Stripe

1. Acesse [stripe.com](https://stripe.com) e crie uma conta
2. Complete o processo de verificação da conta
3. Acesse o Dashboard do Stripe

## 2. Obter Chaves de API

### Modo de Teste (Desenvolvimento)

1. No Dashboard, certifique-se de estar no **Test Mode** (toggle no topo direito)
2. Vá em **Developers → API keys**
3. Copie as seguintes chaves:
   - **Publishable key** (`pk_test_...`)
   - **Secret key** (`sk_test_...`)

### Modo de Produção

1. No Dashboard, altere para **Live Mode** (toggle no topo direito)
2. Vá em **Developers → API keys**
3. Copie as seguintes chaves:
   - **Publishable key** (`pk_live_...`)
   - **Secret key** (`sk_live_...`)

## 3. Configurar Variáveis de Ambiente

Adicione as seguintes variáveis no arquivo `.env.local` (desenvolvimento) e nas configurações do ambiente de produção:

```env
# Stripe API Keys (Test Mode)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Stripe Webhook Secret (será obtido após configurar o webhook)
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price ID (será obtido após criar o produto)
STRIPE_PRICE_ID=price_...

# URL da aplicação (para redirecionamentos)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Importante:** 
- As chaves de **produção** devem ser diferentes das de **teste**
- `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` **nunca** devem ser expostas no cliente
- Nunca commite essas variáveis no Git

## 4. Criar Produto e Preço no Stripe Dashboard

### 4.1 Criar Produto

1. No Dashboard, vá em **Products**
2. Clique em **+ Add product**
3. Preencha os campos:
   - **Name**: `Plano Básico - Daily`
   - **Description**: `Assinatura mensal do sistema Daily`
   - **Active**: Sim (toggle ativado)
4. Clique em **Save product**
5. **Anote o Product ID** (formato: `prod_XXXXXXXXXXXX`)

### 4.2 Criar Preço Recorrente

1. No produto criado, clique em **Add pricing**
2. Configure:
   - **Pricing Model**: Recurring
   - **Price**: `97.00` (em reais)
   - **Billing Period**: Monthly (mensal)
   - **Recurring**: Every 1 month
   - **Currency**: BRL (Real Brasileiro)
3. Clique em **Save pricing**
4. **Anote o Price ID** (formato: `price_XXXXXXXXXXXX`)

5. Adicione o `Price ID` na variável de ambiente `STRIPE_PRICE_ID`

### 4.3 Alternativa: Criar via API

Se preferir criar via código, execute o seguinte script (apenas uma vez):

```typescript
// scripts/create-stripe-product.ts
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

async function createProductAndPrice() {
  // 1. Criar produto
  const product = await stripe.products.create({
    name: 'Plano Básico - Daily',
    description: 'Assinatura mensal do sistema Daily',
  })

  console.log('✅ Produto criado:', product.id)

  // 2. Criar preço recorrente
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: 9700, // R$ 97,00 em centavos
    currency: 'brl',
    recurring: {
      interval: 'month',
      interval_count: 1,
    },
  })

  console.log('✅ Preço criado:', price.id)
  console.log('\n📋 Adicione no .env.local:')
  console.log(`STRIPE_PRICE_ID=${price.id}`)
}

createProductAndPrice().catch(console.error)
```

Execute com:
```bash
npx tsx scripts/create-stripe-product.ts
```

## 5. Configurar Webhook

### 5.1 Criar Endpoint de Webhook no Stripe

1. No Dashboard, vá em **Developers → Webhooks**
2. Clique em **+ Add endpoint**
3. Preencha:
   - **Endpoint URL**: `https://seu-dominio.com/api/webhooks/stripe`
     - Para desenvolvimento local, use Stripe CLI (ver seção 5.2)
   - **Description**: `Webhook para eventos de assinatura do Daily`
4. Selecione os seguintes eventos para escutar:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
5. Clique em **Add endpoint**
6. **Copie o Signing secret** (`whsec_...`) que aparece
7. Adicione o Signing secret na variável de ambiente `STRIPE_WEBHOOK_SECRET`

### 5.2 Testar Webhooks Localmente (Desenvolvimento)

Para desenvolvimento local, use o Stripe CLI:

1. **Instalar Stripe CLI:**
   ```bash
   # macOS
   brew install stripe/stripe-cli/stripe
   
   # Linux
   # Baixe de: https://stripe.com/docs/stripe-cli
   ```

2. **Fazer login:**
   ```bash
   stripe login
   ```

3. **Encaminhar webhooks para localhost:**
   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

4. O comando retornará um **webhook secret temporário** (ex: `whsec_...`)
   - Use este secret no `.env.local` para desenvolvimento
   - O secret muda a cada vez que você executa o comando

5. Em outro terminal, teste eventos:
   ```bash
   stripe trigger checkout.session.completed
   ```

## 6. Testar o Fluxo Completo

### 6.1 Cartões de Teste

O Stripe fornece cartões de teste para simular pagamentos:

- **Sucesso**: `4242 4242 4242 4242`
- **Requer autenticação**: `4000 0025 0000 3155`
- **Falha**: `4000 0000 0000 0002`

Use qualquer:
- CVV: `123`
- Data de expiração: qualquer data futura (ex: `12/34`)
- CEP: qualquer (ex: `12345-678`)

### 6.2 Testar Assinatura

1. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

2. Acesse a página de assinatura: `http://localhost:3000/subscription`

3. Clique em "Assinar Agora"

4. Será redirecionado para o checkout do Stripe

5. Use um cartão de teste para completar o pagamento

6. Verifique no Stripe Dashboard:
   - **Customers**: deve aparecer um novo customer
   - **Subscriptions**: deve aparecer uma nova assinatura
   - **Events**: devem aparecer eventos de webhook

7. Verifique no banco de dados:
   - A tabela `daily_user` deve ter os campos atualizados:
     - `payment_provider`: `'stripe'`
     - `payment_customer_id`: ID do customer no Stripe
     - `payment_subscription_id`: ID da subscription no Stripe
     - `subscription_status`: `'trial'` ou `'active'`
     - `payment_status`: `'paid'`

## 7. Migração de Produção

### 7.1 Checklist Pré-Produção

- [ ] Conta Stripe verificada e aprovada
- [ ] Chaves de API de produção configuradas
- [ ] Produto e preço criados em modo Live
- [ ] Webhook configurado com URL de produção
- [ ] Webhook secret de produção configurado
- [ ] Variáveis de ambiente de produção configuradas
- [ ] Testado em ambiente de staging (se disponível)

### 7.2 Ativar em Produção

1. Altere todas as variáveis de ambiente para usar chaves de **produção**:
   ```env
   STRIPE_SECRET_KEY=sk_live_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_... (do webhook de produção)
   ```

2. Certifique-se de que o `STRIPE_PRICE_ID` está configurado corretamente

3. Faça deploy da aplicação

4. Teste com um pequeno valor ou com um cartão de teste (se disponível)

## 8. Monitoramento

### 8.1 Dashboard do Stripe

Acompanhe no Dashboard:
- **Payments**: Pagamentos processados
- **Subscriptions**: Assinaturas ativas
- **Customers**: Clientes cadastrados
- **Events**: Eventos de webhook (útil para debug)

### 8.2 Logs da Aplicação

Os webhooks logam eventos no console:
- `[STRIPE WEBHOOK] Checkout concluído para usuário: {id}`
- `[STRIPE WEBHOOK] Assinatura atualizada: {subscription_id}`
- `[STRIPE WEBHOOK] Assinatura cancelada: {subscription_id}`

## 9. Solução de Problemas

### Webhook não está sendo recebido

1. Verifique se o webhook está configurado corretamente no Dashboard
2. Verifique se a URL está acessível publicamente (para produção)
3. Para desenvolvimento, use Stripe CLI
4. Verifique os logs de eventos no Dashboard do Stripe

### Erro de assinatura inválida no webhook

1. Verifique se `STRIPE_WEBHOOK_SECRET` está correto
2. Certifique-se de usar o secret correto para o ambiente (test/production)
3. Verifique se o corpo da requisição não está sendo modificado antes da verificação

### Checkout não está criando subscription

1. Verifique se `STRIPE_PRICE_ID` está configurado corretamente
2. Verifique se o Price ID existe no Stripe Dashboard
3. Verifique se o Price está ativo
4. Verifique os logs da API no console

## 10. Referências

- [Documentação Oficial do Stripe](https://stripe.com/docs)
- [Stripe Subscriptions API](https://stripe.com/docs/api/subscriptions)
- [Stripe Checkout Sessions](https://stripe.com/docs/payments/checkout)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)