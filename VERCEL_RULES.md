# Regras de Deploy — Vercel

## Configuração detectada

- **Framework:** Next.js 14.0.0 (App Router)
- **Node.js:** Esperado v20.x (baseado em `@types/node: ^20.10.0`)
- **Comando de build:** `npm run build` (`next build`)
- **Diretório de output:** `.next`
- **Tipo de rendering:** SSR (Server-Side Rendering) e API Routes (Node.js/Serverless). Middleware usa Edge Runtime.
- **Banco de Dados:** MySQL externo (necessita URL de conexão em variáveis de ambiente).

## Regras obrigatórias para todas as implementações

- **Runtime de Middleware:** `middleware.ts` DEVE ser compatível com Edge Runtime. Use apenas bibliotecas como `jose` para JWT; evite `bcryptjs` ou `mysql2` neste arquivo.
- **Segurança de Headers:** `next.config.js` possui CSP e headers de segurança estritos. Qualquer nova rota deve respeitar essas políticas.
- **Conexão MySQL:** O pool de conexões em `lib/mysql.ts` deve ser eficiente para evitar "Too many connections" em lambdas da Vercel (limite de concorrência).
- **Imagens:** O `next.config.js` permite qualquer hostname HTTPS para imagens. Mantenha `unoptimized: false` para usar a otimização da Vercel.

## O que NÃO fazer (causa erro no deploy)

- **Node.js em Edge:** Não importe módulos nativos como `fs`, `path` ou `crypto` (do Node) em arquivos que rodam no Edge (ex: `middleware.ts`).
- **Build Fail:** Não deixe erros de TypeScript ou Lint. O comando `next build` falhará no CI da Vercel se houver erros de tipagem.
- **Secrets no Client:** Nunca use variáveis de ambiente sensíveis (DB_PASSWORD, STRIPE_SECRET) sem o prefixo `NEXT_PUBLIC_` se precisar acessá-las no navegador.
- **Top-level Await:** Evite em arquivos que não suportam o runtime alvo.

## Variáveis de ambiente necessárias

| Variável | Obrigatória | Finalidade |
| :--- | :--- | :--- |
| `DATABASE_URL` | Sim | String de conexão MySQL (`mysql://user:pass@host:port/db`) |
| `JWT_SECRET` | Sim | Chave para assinatura de tokens JWT (usada no login e middleware) |
| `STRIPE_SECRET_KEY` | Sim | Integração com pagamentos Stripe |
| `STRIPE_WEBHOOK_SECRET` | Sim | Validação de eventos do Stripe |
| `WAHA_BASE_URL` | Sim | URL da instância WAHA para WhatsApp |
| `WAHA_API_KEY` | Não | Chave de API para o WAHA (se configurada na instância) |
| `HOTMART_TOKEN` | Sim | Token de segurança hottok para webhooks Hotmart |

## Checklist pré-deploy

- [ ] `npm run lint` passa sem erros.
- [ ] O código em `middleware.ts` não usa APIs exclusivas de Node.js.
- [ ] Todas as novas variáveis de ambiente foram adicionadas ao painel da Vercel.
- [ ] O arquivo `schema.sql` foi aplicado no banco de dados de produção se houve mudanças.
- [ ] Variáveis sensíveis NÃO possuem o prefixo `NEXT_PUBLIC_`.
