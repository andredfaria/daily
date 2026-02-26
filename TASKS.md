# Registro de Tarefas do Projeto

- **Título**: Auditoria e Refatoração de Onboarding
- **Descrição**: Limpeza de arquivos órfãos (Supabase/SWR), consolidação de endpoints de administração em uma única rota PATCH, centralização da lógica de assinaturas e sincronização de tokens de design entre CSS e Tailwind.
- **Status**: Concluída
- **Arquivos tocados**: 
  - `lib/supabase.ts` (Removido)
  - `lib/supabase-admin.ts` (Removido)
  - `lib/swr-config.ts` (Removido)
  - `app/api/admin/users/[id]/route.ts` (Criado - Consolidado)
  - `app/api/admin/users/[id]/update-email/route.ts` (Removido)
  - `app/api/admin/users/[id]/update-password/route.ts` (Removido)
  - `app/api/admin/users/[id]/update-role/route.ts` (Removido)
  - `app/api/admin/users/[id]/update-subscription/route.ts` (Removido)
  - `app/api/admin/users/[id]/link-auth/route.ts` (Removido)
  - `lib/utils/subscription.ts` (Modificado)
  - `app/globals.css` (Modificado)
- **Data**: 2026-02-26
- **Observações**: Os endpoints removidos foram todos integrados na nova rota genérica `PATCH /api/admin/users/[id]`. A lógica de SWR foi removida por não estar sendo utilizada nos hooks atuais.
