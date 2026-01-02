# Daily Status Dashboard 

Dashboard e status diário construído com Next.js, TypeScript, Tailwind CSS e Supabase.

## Configuração

1. Instale as dependências:

```bash
npm install
```

2. Configure as variáveis de ambiente. Crie um arquivo `.env.local` na raiz do projeto:

```env
NEXT_PUBLIC_SUPABASE_URL=https://dmraqfnhffingqzkcfcg.supabase.co/
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_aqui
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key_aqui
NEXT_PUBLIC_WAHA_URL=http://localhost:3000
```

⚠️ **IMPORTANTE**: A `SUPABASE_SERVICE_ROLE_KEY` tem acesso total ao banco e **NUNCA** deve ser exposta publicamente ou commitada no Git. Use apenas no backend.

3. Execute o servidor de desenvolvimento:

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no navegador.

## Estrutura do Projeto

- `app/` - Páginas e layouts do Next.js (App Router)
- `components/` - Componentes React reutilizáveis
- `lib/` - Utilitários e configurações (Supabase, tipos TypeScript)
- `supabase/migrations/` - Migrações SQL do banco de dados
- `docs/` - Documentação técnica do projeto

## Funcionalidades

- Dashboard de usuário com estatísticas de atividades
- Criação de novos usuários com checklist dinâmico
- Listagem de usuários cadastrados
- Edição de usuários com validação em tempo real
- **Sistema de permissões baseado em roles (Admin/Não-Admin)**
- **Controle de acesso granular para edição de usuários**
- **Gestão administrativa avançada**:
  - Alterar permissões de usuários (promover/remover admin)
  - Vincular/desvincular contas de autenticação
  - Alterar email e senha de usuários via Admin API
- Validação de telefone usando WAHA (WhatsApp HTTP API)
- Integração com Supabase para armazenamento de dados
- Webhook para notificações (n8n)
- **Row Level Security (RLS) para segurança em nível de banco**

## Validações

- **Título**: Opcional, mínimo 2 caracteres, máximo 100 caracteres
- **Telefone**: Opcional, validação de formato e verificação via WAHA `/api/contacts/check-exists`
- **Hora de Envio**: Opcional, formato HH
- **Checklist**: Obrigatorio, mínimo 1 item, máximo 50 itens

## Sistema de Permissões

O Daily implementa um sistema robusto de controle de acesso baseado em roles:

### Roles Disponíveis

- **Admin**: Permissão total para visualizar, editar, criar e deletar todos os usuários
- **Não-Admin**: Visualiza todos os usuários, mas só pode editar seus próprios dados

### Segurança

O sistema implementa múltiplas camadas de segurança:

1. **Row Level Security (RLS)** - Políticas no nível do banco de dados Supabase
2. **API Validation** - Endpoint dedicado `/api/users/[id]/validate-edit`
3. **Middleware Protection** - Verificação de permissões em rotas protegidas
4. **Client-Side Validation** - Verificações via `AuthProvider` context
5. **UI Conditional Rendering** - Exibição de botões baseada em permissões

### Documentação Completa

Para mais detalhes sobre o sistema:

- **[Guia de Permissões](docs/PERMISSIONS.md)** - Documentação técnica completa do sistema de roles
- **[Guia de Deploy](docs/DEPLOY_PERMISSIONS.md)** - Instruções passo a passo para deploy
- **[Gestão Administrativa](docs/ADMIN_USER_MANAGEMENT.md)** - Como gerenciar usuários, permissões e credenciais
- **[Changelog](docs/CHANGELOG_PERMISSIONS.md)** - Histórico de mudanças
- **[Migrações](supabase/migrations/README.md)** - Como executar migrações SQL

### Setup Inicial

Após clonar o projeto:

1. **Execute as migrações SQL** (via Supabase Dashboard > SQL Editor):
   ```sql
   -- Execute os scripts em ordem em: supabase/migrations/
   ```

2. **Defina o primeiro administrador**:
   ```sql
   UPDATE public.daily_user 
   SET is_admin = true 
   WHERE id = 1; -- Ou o ID do seu usuário
   ```

3. **Configure a Service Role Key** no `.env.local` (obrigatório para funcionalidades admin)

## Gestão Administrativa

Administradores possuem acesso a funcionalidades avançadas na página de edição de usuários:

### Alterar Permissões
- Promover usuários a administrador
- Remover permissões de admin

### Gerenciar Autenticação
- Vincular usuários existentes a contas do Supabase Auth
- Desvincular contas de autenticação
- Alterar email de login
- Redefinir senhas

### Acesso
- Navegue para `/users`
- Clique em "Editar" em qualquer usuário
- Role até "Configurações Administrativas"

📖 **Guia Completo**: Consulte [docs/ADMIN_USER_MANAGEMENT.md](docs/ADMIN_USER_MANAGEMENT.md) para instruções detalhadas e troubleshooting.
