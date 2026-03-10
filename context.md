# Contexto do Projeto - Daily Status

## 1. O que é este projeto
Plataforma de gerenciamento de atividades e status diários (Daily Status/App), projetada para acompanhar o progresso de usuários através de um sistema de check-ins. O sistema conta com controle de acesso administrativo, gestão de assinaturas recorrentes (trial de 7 dias) e integração com o WhatsApp via WAHA para validação de leads e perfis.

## 2. Stack técnica
- **Framework:** Next.js 14 (App Router)
- **Linguagem:** TypeScript
- **Estilização:** Tailwind CSS
- **Banco de Dados:** MySQL (via `mysql2`)
- **Autenticação:** JWT (usando `jose` para compatibilidade com Edge Runtime) com persistência em Cookies
- **Estado/Fetching:** SWR (Client-side)
- **Ícones:** Lucide React
- **Integrações:** 
  - **Stripe:** Pagamentos e assinaturas
  - **Hotmart:** Webhooks de vendas e assinaturas
  - **WAHA:** API de WhatsApp para validação de números e busca de perfis
  - **Bcryptjs:** Hashing de senhas

## 3. Estrutura de pastas
- `app/`: Contém as rotas, layouts e páginas da aplicação (App Router).
- `app/api/`: Endpoints da API para autenticação, administração, webhooks e integrações.
- `components/`: Componentes React organizados entre componentes de UI reutilizáveis (`/ui`) e componentes de negócio (formulários, tabelas, dashboards).
- `lib/`: Núcleo da lógica do sistema:
  - `lib/db/`: Operações de banco de dados (MySQL) organizadas por entidade.
  - `lib/hooks/`: Custom hooks para gerenciamento de dados via SWR.
  - `lib/middleware/`: Middlewares de proteção de rota e RBAC.
  - `lib/utils/`: Utilitários de formatação, sanitização e lógica de assinaturas.
- `supabase/migrations/`: Histórico de migrações SQL (o projeto migrou de Supabase para MySQL nativo).

## 4. Padrões adotados
- **Arquitetura de Dados:** Uso de queries SQL puras no servidor (MySQL) centralizadas em `lib/db/`.
- **Segurança:** Proteção de rotas via `middleware.ts` validando JWT e permissões de admin.
- **UI/UX:** Uso de Skeletons para estados de carregamento e Toasts para feedbacks de operações.
- **Validação:** Centralizada em `lib/validations.ts` para garantir consistência entre client e server.
- **Integração de Pagamento:** Fluxo de webhook para sincronização automática de status de assinatura (Stripe e Hotmart).

## 5. O que está funcionando
- **Autenticação:** Login, Registro e Logout com sessões baseadas em JWT.
- **Gestão de Usuários (Admin):** Listagem, criação, edição e exclusão de usuários, além de promoção de cargos.
- **Assinaturas:** Sistema de Trial de 7 dias automático na criação da conta. Integração funcional com checkout do Stripe.
- **WhatsApp (WAHA):** Validação de existência de número e extração de dados de perfil (foto, status, pushname).
- **Dashboard:** Visualização de dados e atividades do usuário logado.

## 6. O que está pendente / Incompleto
- **Recuperação de Senha:** O endpoint de `forgot-password` está estruturado mas falta a integração real com um serviço de envio de e-mail (Resend/SendGrid).
- **Outros Provedores de Pagamento:** O schema cita Asaas e MercadoPago, mas as integrações não foram encontradas no código.
- **Migração Supabase:** Existem referências residuais ao Supabase (pastas e arquivos stub) que foram substituídas por MySQL.

## 7. Restrições do projeto
- **Banco de Dados:** Não reintroduzir dependências do Supabase para dados (o projeto agora é estritamente MySQL).
- **Middleware:** Manter o uso de `jose` e APIs compatíveis com Edge Runtime para garantir performance no Next.js.
- **Estilização:** Seguir o padrão de componentes em `components/ui/` e Tailwind CSS; não adicionar bibliotecas de componentes externas (como MUI ou Chakra).
- **Estrutura:** Manter a lógica de banco de dados separada em `lib/db/` e evitar queries SQL diretamente dentro das rotas da API.

## Novas capacidades do sistema
- **Módulo de enquetes com agendamento:** criação de enquetes, opções e envio programado com worker assíncrono e idempotência por destinatário.
- **Webhook WAHA para respostas:** endpoint dedicado para ingestão de respostas e processamento seguro com validação e deduplicação de eventos.
- **Camada de billing extensível (Provider Pattern):** abstração para múltiplos gateways com fluxo unificado de checkout, webhook, upgrade/downgrade e cancelamento.
- **Multi-tenant por workspace:** isolamento lógico de dados por cliente, com memberships e RBAC por tenant.
- **Escalabilidade operacional:** adoção de Redis para rate limiting distribuído, filas para processamento assíncrono e estratégia de read replica/particionamento para alto volume.
- **Observabilidade e auditoria:** trilha de eventos críticos para segurança, compliance e troubleshooting.
- **API pública versionada:** chaves de API por workspace com escopos e limites próprios.
