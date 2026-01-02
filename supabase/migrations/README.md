# Migrações do Banco de Dados

Este diretório contém as migrações SQL para o sistema Daily.

## Ordem de Execução

Execute as migrações na seguinte ordem:

1. **20260102000000_add_is_admin_field.sql** - Adiciona o campo `is_admin` à tabela `daily_user`
2. **20260102000001_add_rls_policies.sql** - Implementa políticas de Row Level Security
3. **20260102000002_set_first_admin.sql** - Define o primeiro usuário como administrador

## Como Executar

### Opção 1: Via Supabase Dashboard

1. Acesse o dashboard do Supabase em https://app.supabase.com
2. Vá para o projeto Daily
3. Navegue para SQL Editor
4. Copie e cole o conteúdo de cada arquivo SQL
5. Execute cada script na ordem especificada

### Opção 2: Via Supabase CLI

```bash
# Navegar para o diretório do projeto
cd /home/andre/Documentos/projetos/daily

# Executar todas as migrações
supabase db push

# OU executar cada migração individualmente
supabase db execute --file supabase/migrations/20260102000000_add_is_admin_field.sql
supabase db execute --file supabase/migrations/20260102000001_add_rls_policies.sql
supabase db execute --file supabase/migrations/20260102000002_set_first_admin.sql
```

## Pós-Migração

### Definir o Primeiro Admin

Após executar as migrações, você precisa definir manualmente qual usuário será o primeiro administrador.

**Opção 1: Por ID do usuário**
```sql
UPDATE public.daily_user 
SET is_admin = true 
WHERE id = 1; -- Substitua 1 pelo ID do usuário desejado
```

**Opção 2: Por email**
```sql
UPDATE public.daily_user 
SET is_admin = true 
WHERE auth_user_id IN (
  SELECT id FROM auth.users WHERE email = 'seu-email@exemplo.com'
);
```

## Alterações no Schema

### Campo `is_admin`

- **Tipo**: `boolean`
- **Default**: `false`
- **NOT NULL**: Sim
- **Descrição**: Flag que indica se o usuário possui permissões de administrador

### Índices Criados

- `idx_daily_user_is_admin` - Otimiza consultas de verificação de admin
- `idx_daily_user_auth_user_id` - Otimiza joins com a tabela auth.users

### Row Level Security (RLS)

Foram implementadas as seguintes políticas:

1. **SELECT**: Todos os usuários autenticados podem visualizar todos os registros
2. **UPDATE**: Apenas admins ou o próprio usuário pode atualizar seus dados
3. **INSERT**: Apenas admins podem criar novos usuários
4. **DELETE**: Apenas admins podem deletar usuários

## Rollback

Caso precise reverter as alterações:

```sql
-- Remover políticas RLS
DROP POLICY IF EXISTS "Usuários podem visualizar todos os registros" ON public.daily_user;
DROP POLICY IF EXISTS "Usuários podem atualizar apenas próprios dados ou admins tudo" ON public.daily_user;
DROP POLICY IF EXISTS "Apenas admins podem criar usuários" ON public.daily_user;
DROP POLICY IF EXISTS "Apenas admins podem deletar usuários" ON public.daily_user;

-- Desabilitar RLS (opcional)
ALTER TABLE public.daily_user DISABLE ROW LEVEL SECURITY;

-- Remover índices
DROP INDEX IF EXISTS idx_daily_user_is_admin;
DROP INDEX IF EXISTS idx_daily_user_auth_user_id;

-- Remover campo is_admin
ALTER TABLE public.daily_user DROP COLUMN IF EXISTS is_admin;
```

## Notas Importantes

- ⚠️ As políticas RLS são **essenciais** para a segurança do sistema
- ⚠️ Certifique-se de definir pelo menos um admin antes de usar o sistema
- ⚠️ O campo `auth_user_id` deve ser UNIQUE e aceitar NULL
- ✅ Os índices melhoram a performance das consultas de permissão
