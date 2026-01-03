# Guia de Gestão Administrativa de Usuários

## Visão Geral

Este guia documenta como administradores podem gerenciar usuários no sistema Daily, incluindo permissões, vinculação de contas de autenticação e alteração de credenciais.

## Índice

- [Pré-requisitos](#pré-requisitos)
- [Acessando a Interface Administrativa](#acessando-a-interface-administrativa)
- [Gerenciamento de Permissões](#gerenciamento-de-permissões)
- [Vinculação de Contas de Autenticação](#vinculação-de-contas-de-autenticação)
- [Alteração de Email](#alteração-de-email)
- [Alteração de Senha](#alteração-de-senha)
- [Cenários Comuns](#cenários-comuns)
- [Troubleshooting](#troubleshooting)
- [Segurança](#segurança)

---

## Pré-requisitos

### Configuração da Service Role Key

Para que as funcionalidades administrativas funcionem, é necessário configurar a **Service Role Key** do Supabase:

1. Acesse o [Dashboard do Supabase](https://app.supabase.com)
2. Vá para Settings > API
3. Copie a **Service Role Key** (atenção: não é a Anon Key)
4. Adicione ao arquivo `.env.local`:

```env
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

⚠️ **IMPORTANTE**: A Service Role Key tem acesso total ao banco de dados e **NUNCA** deve ser exposta no client-side ou commitada no Git.

### Permissões de Administrador

Apenas usuários com `is_admin = true` podem:
- Alterar permissões de outros usuários
- Vincular/desvincular contas de autenticação
- Alterar emails e senhas de outros usuários

Para definir o primeiro admin, execute via SQL Editor do Supabase:

```sql
UPDATE public.daily_user 
SET is_admin = true 
WHERE id = 1; -- Substitua pelo ID do usuário
```

---

## Acessando a Interface Administrativa

1. Faça login com uma conta que possui permissões de admin
2. Navegue para a listagem de usuários (`/users`)
3. Clique em "Editar" no usuário desejado
4. Role até a seção **"Configurações Administrativas"**

> **Nota**: Usuários comuns não veem esta seção e só podem editar seus próprios dados básicos.

---

## Gerenciamento de Permissões

### Promover Usuário a Administrador

1. Acesse a página de edição do usuário
2. Na seção "Permissões de Acesso", clique em **"Promover a Administrador"**
3. Confirme a ação
4. O usuário terá acesso total ao sistema

### Remover Permissões de Administrador

1. Acesse a página de edição do usuário
2. Na seção "Permissões de Acesso", clique em **"Remover Permissões de Admin"**
3. Confirme a ação
4. O usuário só poderá editar seus próprios dados

### Status Atual

Um badge visual indica o status atual:
- 🟣 **Administrador**: Permissão total
- ⚪ **Usuário Comum**: Acesso limitado

---

## Vinculação de Contas de Autenticação

### Por que Vincular?

O sistema Daily separa:
- **daily_user**: Dados do usuário no sistema (nome, telefone, checklist)
- **auth.users**: Conta de autenticação do Supabase (email, senha, login)

A vinculação permite que um `daily_user` faça login no sistema usando credenciais do Supabase Auth.

### Vincular Conta Existente

1. Na seção "Vinculação com Autenticação", se o usuário não estiver vinculado, você verá uma mensagem amarela
2. Selecione um usuário de autenticação no dropdown
   - Apenas contas **não vinculadas** aparecem na lista
   - Contas confirmadas têm um ✓ ao lado do email
3. Clique em **"Vincular Conta Selecionada"**
4. Confirme a ação
5. O usuário agora pode fazer login com esse email/senha

### Desvincular Conta

1. Se o usuário já estiver vinculado, você verá uma mensagem verde com o email atual
2. Clique em **"Desvincular Conta"**
3. Confirme a ação
4. O usuário não poderá mais fazer login (mas os dados em `daily_user` são mantidos)

### Erros Comuns

- **"Este usuário de autenticação já está vinculado a outro usuário"**: Cada `auth_user` só pode ser vinculado a um `daily_user` por vez
- **"Usuário de autenticação não encontrado"**: O UUID fornecido não existe em `auth.users`

---

## Alteração de Email

### Como Alterar

1. **Pré-requisito**: O usuário deve estar vinculado a uma conta de autenticação
2. Na seção "Alterar Email", digite o novo endereço de email
3. Clique em **"Atualizar Email"**
4. Confirme a ação
5. O email será atualizado no Supabase Auth

### Validações

- Formato de email válido
- Email não pode estar em uso por outro usuário
- Mínimo 3 caracteres

### Avisos

- O usuário deverá usar o **novo email** para fazer login
- Dependendo da configuração do Supabase, pode ser enviado um email de confirmação

---

## Alteração de Senha

### Como Alterar

1. **Pré-requisito**: O usuário deve estar vinculado a uma conta de autenticação
2. Na seção "Alterar Senha":
   - Digite a nova senha (mínimo 8 caracteres)
   - Confirme a senha
3. Clique em **"Atualizar Senha"**
4. Confirme a ação
5. A senha será atualizada imediatamente

### Validações

- Mínimo 8 caracteres
- As senhas devem coincidir
- Não é necessário informar a senha antiga (operação administrativa)

### Avisos

- A senha antiga deixará de funcionar imediatamente
- Informe o usuário sobre a nova senha por um canal seguro
- Por segurança, recomende que o usuário altere a senha no primeiro login

---

## Cenários Comuns

### 1. Criar um Usuário com Login

**Passo a Passo:**

1. Crie o `daily_user` normalmente via interface (`/create`)
2. No Supabase Dashboard, crie um usuário em Authentication > Users
3. Na edição do `daily_user`, vincule o `auth_user_id` criado
4. O usuário já pode fazer login

**Alternativa (via SQL):**

```sql
-- 1. Inserir daily_user
INSERT INTO public.daily_user (name, phone, title, option, time_to_send)
VALUES ('João Silva', '5511999999999@c.us', 'Dev', '["✅ Task 1"]', 9);

-- 2. Criar auth user (via Dashboard ou API)
-- 3. Vincular
UPDATE public.daily_user 
SET auth_user_id = 'uuid-do-auth-user'
WHERE id = 123;
```

### 2. Usuário Esqueceu a Senha

**Opção 1: Reset via Admin**

1. Acesse a edição do usuário
2. Vá em "Alterar Senha"
3. Defina uma nova senha temporária
4. Informe o usuário e peça para alterar no primeiro login

**Opção 2: Fluxo de Recuperação**

Use o fluxo padrão do Supabase (link de reset via email).

### 3. Migrar Usuário para Outra Conta de Autenticação

```sql
-- Desvincular conta antiga
UPDATE public.daily_user 
SET auth_user_id = NULL 
WHERE id = 123;

-- Vincular nova conta
UPDATE public.daily_user 
SET auth_user_id = 'novo-uuid'
WHERE id = 123;
```

Ou use a interface administrativa para desvincular e depois vincular.

### 4. Remover Acesso de Login

Simplesmente desvincule a conta de autenticação:

1. Edite o usuário
2. Clique em "Desvincular Conta"
3. Os dados do `daily_user` são mantidos, mas o login é desabilitado

---

## Troubleshooting

### "Apenas administradores podem..."

**Problema**: Você não tem permissões de admin.

**Solução**: Peça a outro admin que promova seu usuário, ou execute via SQL:

```sql
UPDATE public.daily_user 
SET is_admin = true 
WHERE auth_user_id = (SELECT id FROM auth.users WHERE email = 'seu-email@exemplo.com');
```

### "Este email já está em uso"

**Problema**: O email que você está tentando usar já existe em `auth.users`.

**Solução**: 
- Escolha outro email, ou
- Remova o usuário duplicado do Authentication > Users (se for um erro)

### "Usuário de autenticação não encontrado"

**Problema**: O UUID fornecido não existe em `auth.users`.

**Solução**:
- Verifique se o UUID está correto
- Confirme que o usuário existe em Authentication > Users no Supabase Dashboard

### "SUPABASE_SERVICE_ROLE_KEY não configurado"

**Problema**: A variável de ambiente não foi definida.

**Solução**:
1. Adicione ao `.env.local`
2. Reinicie o servidor de desenvolvimento
3. Em produção, configure via variáveis de ambiente da Vercel/plataforma

### Campos Administrativos Não Aparecem

**Verificações**:

1. Você está logado como admin?
2. Está na página de **edição** (`/edit?id=X`)?
3. O `is_admin` do seu usuário está `true`?

```sql
-- Verificar status de admin
SELECT id, name, is_admin, auth_user_id 
FROM public.daily_user 
WHERE auth_user_id = 'seu-uuid';
```

---

## Segurança

### Boas Práticas

1. **Service Role Key**
   - Nunca commite no Git
   - Use variáveis de ambiente
   - Guarde em local seguro (ex: 1Password, Vault)

2. **Permissões de Admin**
   - Conceda apenas a usuários confiáveis
   - Audite regularmente quem tem acesso admin
   - Considere criar níveis intermediários no futuro (moderador, etc)

3. **Logs de Auditoria**
   - Todas as operações administrativas geram logs no console
   - Em produção, considere enviar para serviço de logging externo
   - Formato: `[AUDIT] Admin {email} ({uuid}) {ação} {detalhes}`

4. **Senhas**
   - Nunca mostre senhas em logs
   - Use senhas temporárias fortes ao resetar
   - Recomende troca no primeiro login

5. **Acesso aos Endpoints**
   - Todos os endpoints em `/api/admin/*` verificam permissões
   - Mesmo com Service Role Key, o backend valida `is_admin`
   - RLS do banco fornece camada extra de proteção

### Hierarquia de Segurança

```
1. RLS no Banco (Supabase)
   ↓
2. Validação no Backend (API Routes)
   ↓
3. Validação no Middleware
   ↓
4. Verificação no Cliente (UX)
```

Mesmo que uma camada falhe, as outras garantem a segurança.

---

## Queries Úteis

### Listar Todos os Admins

```sql
SELECT id, name, auth_user_id, created_at 
FROM public.daily_user 
WHERE is_admin = true 
ORDER BY created_at DESC;
```

### Usuários Vinculados vs Não Vinculados

```sql
-- Com login
SELECT COUNT(*) as total_com_login
FROM public.daily_user 
WHERE auth_user_id IS NOT NULL;

-- Sem login
SELECT COUNT(*) as total_sem_login
FROM public.daily_user 
WHERE auth_user_id IS NULL;
```

### Verificar Vinculação Duplicada

```sql
-- Não deveria retornar nada
SELECT auth_user_id, COUNT(*) as total
FROM public.daily_user 
WHERE auth_user_id IS NOT NULL
GROUP BY auth_user_id
HAVING COUNT(*) > 1;
```

### Buscar Usuário por Email

```sql
SELECT du.*, au.email
FROM public.daily_user du
LEFT JOIN auth.users au ON du.auth_user_id = au.id
WHERE au.email = 'usuario@exemplo.com';
```

---

## Recursos Adicionais

- [Documentação do Supabase Auth](https://supabase.com/docs/guides/auth)
- [Admin API Reference](https://supabase.com/docs/reference/javascript/auth-admin-api)
- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)

---

*Última atualização: 2026-01-02*
