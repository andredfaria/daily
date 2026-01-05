# Documento de Requisitos do Sistema - Daily Status Dashboard

## Sumário Executivo

O **Daily Status Dashboard** é um sistema web desenvolvido com Next.js 14, TypeScript, Tailwind CSS e Supabase que permite o gerenciamento de usuários e acompanhamento de atividades diárias através de enquetes enviadas via WhatsApp. O sistema implementa um robusto controle de acesso baseado em roles (Admin/Não-Admin) com múltiplas camadas de segurança.

**Versão:** 0.1.0  
**Data:** Janeiro de 2026  
**Tecnologias:** Next.js 14, TypeScript, Tailwind CSS, Supabase, WAHA (WhatsApp HTTP API)

---

## 1. VISÃO GERAL DO SISTEMA

### 1.1 Propósito

O sistema tem como objetivo principal:
- Gerenciar usuários que receberão enquetes diárias via WhatsApp
- Acompanhar as respostas e estatísticas das atividades realizadas
- Permitir administração centralizada de usuários, permissões e credenciais
- Fornecer dashboards visuais com KPIs e evolução de atividades

### 1.2 Escopo

**Inclui:**
- Gestão completa de usuários (CRUD)
- Sistema de autenticação com Supabase Auth
- Controle de acesso baseado em roles (Admin/Não-Admin)
- Validação de telefones via WhatsApp (WAHA API)
- Dashboard com visualização de estatísticas
- Gerenciamento de enquetes personalizadas
- Gestão administrativa (permissões, credenciais, vinculações)

**Não Inclui:**
- Envio automático de mensagens WhatsApp (apenas validação)
- Sistema de pagamentos
- Aplicativo móvel nativo
- Sistema de notificações por email

### 1.3 Usuários do Sistema

1. **Administradores**
   - Acesso total ao sistema
   - Podem criar, editar e deletar qualquer usuário
   - Gerenciam permissões de outros usuários
   - Vinculam/desvinculam contas de autenticação
   - Alteram emails e senhas de usuários

2. **Usuários Comuns**
   - Visualizam todos os usuários
   - Podem editar apenas seus próprios dados
   - Acesso ao dashboard de suas próprias atividades

---

## 2. REQUISITOS FUNCIONAIS

### RF-001: Gestão de Usuários

#### RF-001.1: Criar Usuário
- **Descrição:** Permite criar um novo usuário no sistema
- **Atores:** Administrador
- **Pré-condições:** Usuário autenticado como administrador
- **Pós-condições:** Usuário criado e armazenado no banco de dados

**Campos:**
- Nome (opcional, 2-100 caracteres)
- Telefone (obrigatório, validado via WAHA)
- Título da Enquete (opcional, 2-100 caracteres)
- Hora de Envio (opcional, formato HH:mm)
- Checklist/Opções da Enquete (opcional, máximo 200 caracteres por item)

**Fluxo Principal:**
1. Administrador acessa a página de criação (`/create`)
2. Preenche os campos do formulário
3. Adiciona itens ao checklist
4. Insere telefone e valida via WhatsApp ao sair do campo
5. Sistema valida todos os campos
6. Clica em "Criar Lead"
7. Sistema salva o usuário no banco de dados
8. Exibe mensagem de sucesso

**Regras de Negócio:**
- RN-001: Apenas administradores podem criar usuários
- RN-002: Telefone deve ser validado via WAHA antes de salvar
- RN-003: Checklist é armazenado como array JSON stringificado
- RN-004: Hora de envio é armazenada apenas a hora cheia (integer 0-23)

#### RF-001.2: Listar Usuários
- **Descrição:** Exibe lista de todos os usuários cadastrados
- **Atores:** Administrador, Usuário Comum
- **Pré-condições:** Usuário autenticado

**Informações Exibidas:**
- ID do usuário
- Nome
- Título
- Telefone (sem @c.us)
- Hora de envio
- Quantidade de itens no checklist
- Data de criação
- Ações disponíveis (Ver Dashboard, Editar)

**Fluxo Principal:**
1. Usuário acessa a página de usuários (`/users`)
2. Sistema carrega e exibe lista de usuários
3. Lista ordenada por data de criação (mais recente primeiro)
4. Exibe ações conforme permissões do usuário

**Regras de Negócio:**
- RN-005: Todos os usuários autenticados podem visualizar todos os registros
- RN-006: Botão "Editar" só aparece se o usuário tem permissão de edição
- RN-007: Administradores veem botão "Editar" para todos os usuários

#### RF-001.3: Editar Usuário
- **Descrição:** Permite editar dados de um usuário existente
- **Atores:** Administrador (todos os usuários), Usuário Comum (apenas seus dados)
- **Pré-condições:** 
  - Usuário autenticado
  - Usuário tem permissão para editar (admin ou próprio usuário)

**Fluxo Principal:**
1. Usuário acessa página de edição (`/edit?id=X`)
2. Sistema verifica permissões (middleware + API)
3. Carrega dados do usuário selecionado
4. Usuário modifica campos desejados
5. Valida telefone se foi alterado
6. Clica em "Salvar"
7. Sistema atualiza o registro
8. Exibe mensagem de sucesso

**Fluxo Alternativo - Campos Administrativos:**
1. Se usuário é administrador, exibe seção "Configurações Administrativas"
2. Permite alterar permissões (promover/remover admin)
3. Permite vincular/desvincular contas de autenticação
4. Permite alterar email e senha de login

**Regras de Negócio:**
- RN-008: Administradores podem editar qualquer usuário
- RN-009: Usuários comuns só podem editar seus próprios dados
- RN-010: Se telefone não mudou, não é necessário revalidar com WAHA
- RN-011: Campos administrativos só aparecem para administradores

#### RF-001.4: Deletar Usuário
- **Descrição:** Remove um usuário do sistema
- **Atores:** Administrador
- **Pré-condições:** Usuário autenticado como administrador

**Fluxo Principal:**
1. Administrador clica no botão de deletar na lista de usuários
2. Sistema exibe confirmação
3. Administrador confirma a ação
4. Sistema remove o usuário do banco
5. Atualiza a lista de usuários

**Regras de Negócio:**
- RN-012: Apenas administradores podem deletar usuários
- RN-013: Requer confirmação explícita do usuário
- RN-014: Dados relacionados em `daily_data` são mantidos (foreign key)

### RF-002: Sistema de Autenticação

#### RF-002.1: Login
- **Descrição:** Permite que usuários façam login no sistema
- **Atores:** Todos os usuários com conta vinculada
- **Pré-condições:** Usuário possui conta no Supabase Auth vinculada a um daily_user

**Fluxo Principal:**
1. Usuário acessa `/login`
2. Insere email e senha
3. Sistema valida credenciais via Supabase Auth
4. Se válido, cria sessão e redireciona para `/`
5. Se inválido, exibe mensagem de erro

**Regras de Negócio:**
- RN-015: Apenas usuários com `auth_user_id` vinculado podem fazer login
- RN-016: Sessão é gerenciada via cookies do Supabase
- RN-017: Usuários autenticados não podem acessar `/login` (redirecionados para `/`)

#### RF-002.2: Logout
- **Descrição:** Permite que usuários encerrem sua sessão
- **Atores:** Usuários autenticados
- **Pré-condições:** Usuário autenticado

**Fluxo Principal:**
1. Usuário clica em "Sair" no menu/navbar
2. Sistema chama endpoint `/api/auth/logout`
3. Encerra sessão do Supabase
4. Redireciona para `/login`

**Regras de Negócio:**
- RN-018: Logout limpa todos os cookies de sessão
- RN-019: Após logout, usuário é redirecionado para login

#### RF-002.3: Registro
- **Descrição:** Permite criação de novas contas de autenticação
- **Atores:** Novos usuários
- **Pré-condições:** Nenhuma

**Fluxo Principal:**
1. Usuário acessa `/register`
2. Preenche email e senha
3. Sistema cria conta no Supabase Auth
4. Redireciona para `/login` ou home

**Regras de Negócio:**
- RN-020: Senha deve ter mínimo 8 caracteres
- RN-021: Email deve ser único no sistema
- RN-022: Conta criada não tem `daily_user` vinculado automaticamente

### RF-003: Dashboard e Visualizações

#### RF-003.1: Dashboard do Usuário
- **Descrição:** Exibe estatísticas e atividades de um usuário específico
- **Atores:** Todos os usuários autenticados
- **Pré-condições:** Usuário autenticado e ID de usuário válido na URL

**Informações Exibidas:**

**Seção 1 - Cabeçalho do Usuário:**
- Foto de perfil do WhatsApp (se disponível)
- Nome do usuário
- Pushname do WhatsApp
- Status/About do WhatsApp
- Telefone
- Badge "Ativo"

**Seção 2 - KPIs (4 Cards):**
1. **Taxa de Conclusão**
   - Percentual de atividades concluídas
   - Barra de progresso colorida (vermelho < 40%, amarelo 40-80%, verde > 80%)

2. **Total de Atividades**
   - Quantidade total de registros em `daily_data`

3. **Dias Concluídos**
   - Quantidade de atividades com `check_status = true`
   - Badge "Performance positiva"

4. **Próximo Envio**
   - Hora programada para envio (time_to_send)
   - Ícone de relógio

**Seção 3 - Enquete WhatsApp:**
- Exibição visual da enquete com design do WhatsApp
- Título da enquete
- Lista de opções do checklist
- Quantidade de opções
- Horário de envio

**Seção 4 - Evolução das Atividades:**
- Grid/heatmap dos últimos 14 dias
- Linhas = opções únicas do checklist
- Colunas = datas (últimos 14 dias)
- Células:
  - Verde = atividade concluída
  - Vermelho = atividade não concluída
  - Cinza = sem registro

**Seção 5 - Histórico de Atividades:**
- Tabela com todas as atividades
- Colunas: Data, Opção, Status, Detalhes
- Ordenação por data decrescente

**Fluxo Principal:**
1. Usuário acessa `/?id=X`
2. Sistema carrega dados do usuário
3. Busca atividades em `daily_data`
4. Busca perfil do WhatsApp via WAHA
5. Calcula estatísticas
6. Renderiza todas as seções

**Regras de Negócio:**
- RN-023: Dashboard é público para qualquer usuário autenticado
- RN-024: Dados do WhatsApp são carregados assincronamente
- RN-025: Se não houver ID na URL, exibe mensagem "Nenhum usuário selecionado"

### RF-004: Validação de Telefone

#### RF-004.1: Validação via WAHA
- **Descrição:** Valida se um número de telefone existe no WhatsApp
- **Atores:** Sistema (automático)
- **Pré-condições:** WAHA configurado e acessível

**Fluxo Principal:**
1. Usuário insere telefone no campo
2. Ao perder o foco (blur), sistema dispara validação
3. Exibe ícone de "validando..."
4. Chama endpoint `/api/waha/validate-phone`
5. Endpoint chama WAHA: `GET /api/contacts/check-exists`
6. Recebe resposta com `numberExists` e `chatId`
7. Se válido:
   - Exibe check verde
   - Salva `chatId` completo (com @c.us)
   - Atualiza campo com número validado
8. Se inválido:
   - Exibe mensagem de erro
   - Bloqueia submit do formulário

**Validação de Formato (antes de chamar WAHA):**
- Remove espaços, parênteses, hífens
- Valida regex: `^\+?[1-9]\d{9,14}$`
- Deve conter 10-15 dígitos

**Regras de Negócio:**
- RN-026: Telefone só é salvo no formato retornado pelo WAHA (`chatId`)
- RN-027: Em modo edição, se telefone não mudou, não revalida
- RN-028: Se WAHA não estiver configurado/disponível, retorna erro
- RN-029: Números brasileiros devem ter código 55 e o 9 após o DDD

### RF-005: Gestão Administrativa

#### RF-005.1: Alterar Permissões de Usuário
- **Descrição:** Promove/remove usuário de administrador
- **Atores:** Administrador
- **Pré-condições:** Usuário autenticado como administrador

**Fluxo Principal:**
1. Administrador acessa edição de um usuário
2. Na seção "Permissões de Acesso", visualiza status atual
3. Clica em "Promover a Administrador" ou "Remover Permissões de Admin"
4. Sistema exibe confirmação
5. Administrador confirma
6. Sistema chama `/api/admin/users/[id]/update-role`
7. Endpoint valida permissões
8. Atualiza campo `is_admin` no banco
9. Exibe mensagem de sucesso
10. Atualiza UI com novo status

**Regras de Negócio:**
- RN-030: Apenas administradores podem alterar permissões
- RN-031: Operação requer confirmação dupla
- RN-032: Gera log de auditoria no console
- RN-033: Atualização é imediata, não requer logout/login

#### RF-005.2: Vincular Conta de Autenticação
- **Descrição:** Vincula um `auth_user_id` do Supabase Auth a um `daily_user`
- **Atores:** Administrador
- **Pré-condições:** 
  - Usuário autenticado como administrador
  - Usuário alvo não possui `auth_user_id` vinculado

**Fluxo Principal:**
1. Administrador acessa edição de usuário sem conta vinculada
2. Seção "Vinculação com Autenticação" exibe mensagem amarela
3. Sistema carrega lista de contas de autenticação disponíveis
4. Lista exibe apenas contas NÃO vinculadas
5. Administrador seleciona uma conta do dropdown
6. Clica em "Vincular Conta Selecionada"
7. Sistema exibe confirmação com o email
8. Administrador confirma
9. Sistema chama `/api/admin/users/[id]/link-auth`
10. Endpoint valida que o `auth_user_id` existe
11. Valida que não está vinculado a outro usuário
12. Atualiza `daily_user.auth_user_id`
13. Exibe mensagem de sucesso
14. Recarrega lista de contas disponíveis

**Fluxo Alternativo - Desvincular:**
1. Se usuário já está vinculado, mostra mensagem verde com email
2. Administrador clica em "Desvincular Conta"
3. Sistema exibe confirmação
4. Define `auth_user_id = null`
5. Usuário perde acesso ao login

**Regras de Negócio:**
- RN-034: Um `auth_user_id` só pode estar vinculado a um `daily_user`
- RN-035: Um `daily_user` só pode ter um `auth_user_id`
- RN-036: Desvincular não deleta a conta em `auth.users`
- RN-037: Após desvincular, conta fica disponível para nova vinculação
- RN-038: Campo `auth_user_id` tem constraint UNIQUE no banco

#### RF-005.3: Alterar Email de Usuário
- **Descrição:** Altera o email de login de um usuário
- **Atores:** Administrador
- **Pré-condições:** 
  - Usuário autenticado como administrador
  - Usuário alvo possui `auth_user_id` vinculado

**Fluxo Principal:**
1. Administrador acessa edição de usuário vinculado
2. Seção "Alterar Email" exibe campo de novo email
3. Administrador digita novo email
4. Clica em "Atualizar Email"
5. Sistema exibe confirmação
6. Administrador confirma
7. Sistema chama `/api/admin/users/[id]/update-email`
8. Endpoint valida que email é válido
9. Chama Supabase Admin API: `updateUserById()`
10. Atualiza email no `auth.users`
11. Exibe mensagem de sucesso

**Validações:**
- Email deve ter formato válido
- Email não pode estar em uso por outro usuário
- Mínimo 3 caracteres

**Regras de Negócio:**
- RN-039: Apenas administradores podem alterar email
- RN-040: Usuário deve estar vinculado a uma conta de autenticação
- RN-041: Novo email deve ser único no sistema
- RN-042: Usuário usará novo email no próximo login
- RN-043: Dependendo da configuração do Supabase, pode enviar email de confirmação

#### RF-005.4: Alterar Senha de Usuário
- **Descrição:** Define nova senha para um usuário
- **Atores:** Administrador
- **Pré-condições:** 
  - Usuário autenticado como administrador
  - Usuário alvo possui `auth_user_id` vinculado

**Fluxo Principal:**
1. Administrador acessa edição de usuário vinculado
2. Seção "Alterar Senha" exibe campos:
   - Nova Senha
   - Confirmar Nova Senha
3. Administrador preenche ambos os campos
4. Clica em "Atualizar Senha"
5. Sistema exibe confirmação
6. Administrador confirma
7. Sistema chama `/api/admin/users/[id]/update-password`
8. Endpoint valida que senha tem mínimo 8 caracteres
9. Valida que senhas coincidem
10. Chama Supabase Admin API: `updateUserById()`
11. Atualiza senha no `auth.users`
12. Exibe mensagem de sucesso
13. Limpa campos de senha

**Validações:**
- Senha deve ter mínimo 8 caracteres
- Senhas devem coincidir
- Não é necessário informar senha antiga (operação administrativa)

**Regras de Negócio:**
- RN-044: Apenas administradores podem alterar senha
- RN-045: Não é necessário validar senha antiga
- RN-046: Senha antiga deixa de funcionar imediatamente
- RN-047: Recomendado passar senha temporária e pedir troca no primeiro login

### RF-006: Integração com WhatsApp (WAHA)

#### RF-006.1: Buscar Perfil do WhatsApp
- **Descrição:** Busca informações completas do perfil de um número no WhatsApp
- **Atores:** Sistema (automático)
- **Pré-condições:** Telefone válido e WAHA configurado

**Informações Buscadas:**
1. **Foto de Perfil** (`profilePicUrl`)
2. **Pushname** (nome exibido no WhatsApp)
3. **About/Status** (recado do usuário)
4. **Chat ID** (identificador completo)

**Fluxo Principal:**
1. Dashboard carrega dados do usuário
2. Se usuário tem telefone, chama `getWhatsAppProfile()`
3. Função chama endpoint `/api/waha/profile`
4. Endpoint faz 3 requisições paralelas ao WAHA:
   - `GET /api/contacts/profile-picture?contactId=X`
   - `GET /api/contacts/about?contactId=X`
   - `GET /api/contacts?contactId=X`
5. Combina resultados em um objeto `WAHAProfile`
6. Retorna para o frontend
7. Dashboard exibe informações nas seções apropriadas

**Regras de Negócio:**
- RN-048: Busca de perfil é assíncrona e não bloqueia renderização
- RN-049: Se WAHA não retornar dados, dashboard funciona sem as informações
- RN-050: Foto de perfil é carregada com `unoptimized` (Next.js Image)
- RN-051: Requisições usam `X-Api-Key` se configurado

---

## 3. REQUISITOS NÃO-FUNCIONAIS

### RNF-001: Desempenho
- **RNF-001.1:** Página deve carregar em menos de 2 segundos
- **RNF-001.2:** Listagem de usuários deve suportar até 1000 registros sem paginação perceptível
- **RNF-001.3:** Validação de telefone via WAHA deve responder em menos de 3 segundos
- **RNF-001.4:** Dashboard deve renderizar com loading states durante carregamento assíncrono

### RNF-002: Segurança
- **RNF-002.1:** Implementar múltiplas camadas de segurança:
  1. Row Level Security (RLS) no Supabase
  2. Validação em API Routes
  3. Middleware de autenticação
  4. Verificação client-side (UX)

- **RNF-002.2:** Service Role Key nunca deve ser exposta no client-side
- **RNF-002.3:** Senhas não devem aparecer em logs
- **RNF-002.4:** Todas as operações administrativas devem gerar logs de auditoria
- **RNF-002.5:** Sessões devem expirar conforme configuração do Supabase
- **RNF-002.6:** HTTPS obrigatório em produção
- **RNF-002.7:** Variáveis de ambiente sensíveis não podem ser commitadas no Git

### RNF-003: Usabilidade
- **RNF-003.1:** Interface responsiva para desktop, tablet e mobile
- **RNF-003.2:** Feedback visual para todas as ações do usuário
- **RNF-003.3:** Mensagens de erro claras e acionáveis
- **RNF-003.4:** Loading states para operações assíncronas
- **RNF-003.5:** Confirmação antes de ações destrutivas (deletar, desvincular)
- **RNF-003.6:** Validação em tempo real nos formulários

### RNF-004: Confiabilidade
- **RNF-004.1:** Sistema deve tratar graciosamente erros de conexão com WAHA
- **RNF-004.2:** Operações de banco devem ter tratamento de erro robusto
- **RNF-004.3:** Falhas de validação não devem corromper dados existentes
- **RNF-004.4:** Sistema deve funcionar mesmo se WAHA estiver offline (com limitações)

### RNF-005: Manutenibilidade
- **RNF-005.1:** Código TypeScript com tipagem forte
- **RNF-005.2:** Componentes React reutilizáveis
- **RNF-005.3:** Separação clara entre lógica de negócio e apresentação
- **RNF-005.4:** Documentação inline para funções complexas
- **RNF-005.5:** Estrutura de pastas organizada (app, components, lib)
- **RNF-005.6:** Uso de convenções do Next.js 14 (App Router)

### RNF-006: Escalabilidade
- **RNF-006.1:** Arquitetura serverless via Vercel/Next.js
- **RNF-006.2:** Banco de dados Supabase gerenciado
- **RNF-006.3:** Assets estáticos servidos via CDN
- **RNF-006.4:** Código preparado para cache e otimizações

### RNF-007: Compatibilidade
- **RNF-007.1:** Suporte aos navegadores:
  - Chrome/Edge (últimas 2 versões)
  - Firefox (últimas 2 versões)
  - Safari (últimas 2 versões)
- **RNF-007.2:** Compatibilidade com dispositivos móveis iOS e Android

### RNF-008: Acessibilidade
- **RNF-008.1:** Contraste de cores adequado (mínimo WCAG AA)
- **RNF-008.2:** Textos alternativos para imagens
- **RNF-008.3:** Navegação por teclado funcional
- **RNF-008.4:** Hierarquia semântica de headings

---

## 4. REGRAS DE NEGÓCIO CONSOLIDADAS

### RN-001 a RN-051
*(Todas as regras já estão documentadas nas seções de Requisitos Funcionais acima)*

**Regras Adicionais:**

#### RN-052: Armazenamento de Checklist
- Checklist é armazenado no campo `option` como string JSON
- Formato: `["item1", "item2", "item3"]`
- Cada item pode ter até 200 caracteres
- Não há limite de itens, mas UI recomenda até 50

#### RN-053: Formato de Telefone
- No banco: armazenado com `@c.us` (ex: `5511999999999@c.us`)
- Na exibição: sem `@c.us` (ex: `5511999999999`)
- Na validação: aceita diversos formatos (+55 11 99999-9999, 5511999999999, etc)
- Após validação: sempre no formato do chatId retornado pelo WAHA

#### RN-054: Hora de Envio
- Armazenada como integer 0-23 no campo `time_to_send`
- Exibida como "00h" até "23h"
- No formulário: seleção via dropdown de 24 opções
- Valor `null` indica "não definido"

#### RN-055: Datas e Timestamps
- Todas as datas em `created_at` usam `timestamp with time zone`
- `activity_date` em `daily_data` é tipo `date`
- Timestamps gerados automaticamente pelo banco (DEFAULT now())

#### RN-056: Relacionamentos
- `daily_user.auth_user_id` → `auth.users.id` (FOREIGN KEY)
- `daily_data.id_user` → `daily_user.id` (FOREIGN KEY)
- Ambos são opcionais (nullable) para flexibilidade

#### RN-057: Soft Delete
- Sistema não implementa soft delete
- Deleções são permanentes (hard delete)
- Requer confirmação explícita do usuário

#### RN-058: Auditoria
- Operações administrativas geram logs no console
- Formato: `[AUDIT] Admin {email} ({uuid}) {ação} {detalhes}`
- Em produção, recomenda-se enviar para serviço externo

---

## 5. MODELO DE DADOS

### 5.1 Tabelas Principais

#### Tabela: `daily_user`

| Campo | Tipo | Obrigatório | Único | Default | Descrição |
|-------|------|-------------|-------|---------|-----------|
| `id` | bigint | Sim | Sim | IDENTITY | ID auto-incremental |
| `created_at` | timestamp with time zone | Sim | Não | now() | Data de criação |
| `phone` | text | Não | Sim | - | Telefone (formato: X@c.us) |
| `title` | text | Não | Não | - | Título da enquete |
| `name` | text | Não | Não | - | Nome do usuário |
| `time_to_send` | integer | Não | Não | - | Hora de envio (0-23) |
| `option` | text | Não | Não | - | JSON array de strings |
| `auth_user_id` | uuid | Não | Sim | - | FK para auth.users |
| `is_admin` | boolean | Sim | Não | false | Flag de administrador |

**Índices:**
- `idx_daily_user_is_admin` ON (`is_admin`)
- `idx_daily_user_auth_user_id` ON (`auth_user_id`)

**Constraints:**
- `daily_user_pkey` PRIMARY KEY (`id`)
- `daily_user_auth_user_id_fkey` FOREIGN KEY (`auth_user_id`) REFERENCES `auth.users(id)`
- `phone` UNIQUE
- `auth_user_id` UNIQUE

**RLS Policies:**
1. **SELECT:** Todos autenticados podem visualizar todos os registros
2. **UPDATE:** Admins ou próprio usuário
3. **INSERT:** Apenas admins
4. **DELETE:** Apenas admins

#### Tabela: `daily_data`

| Campo | Tipo | Obrigatório | Único | Default | Descrição |
|-------|------|-------------|-------|---------|-----------|
| `id` | bigint | Sim | Sim | IDENTITY | ID auto-incremental |
| `id_user` | bigint | Sim | Não | - | FK para daily_user |
| `created_at` | timestamp with time zone | Sim | Não | now() | Data de criação |
| `activity_date` | date | Sim | Não | CURRENT_DATE | Data da atividade |
| `check_status` | boolean | Não | Não | false | Status de conclusão |
| `option` | text | Não | Não | - | Opção selecionada |

**Constraints:**
- `daily_data_pkey` PRIMARY KEY (`id`)
- `daily_data_id_user_fkey` FOREIGN KEY (`id_user`) REFERENCES `daily_user(id)`

#### Tabela: `auth.users` (Supabase Auth)

Gerenciada pelo Supabase. Campos principais:
- `id` (uuid) - Primary Key
- `email` (text)
- `encrypted_password` (text)
- `email_confirmed_at` (timestamp)
- `last_sign_in_at` (timestamp)
- `created_at` (timestamp)
- Outros campos de autenticação

### 5.2 Relacionamentos

```
auth.users (1) ←→ (0..1) daily_user
   └─ Vinculação via auth_user_id
   └─ Um auth_user pode ter no máximo um daily_user
   └─ Um daily_user pode ter no máximo um auth_user

daily_user (1) ←→ (0..*) daily_data
   └─ Relação via id_user
   └─ Um usuário pode ter várias atividades
   └─ Cada atividade pertence a um usuário
```

---

## 6. FLUXOS PRINCIPAIS

### 6.1 Fluxo de Criação de Usuário Completo

```
1. Administrador faz login
   ↓
2. Acessa /users → clica "Novo Usuário"
   ↓
3. Preenche formulário em /create
   - Nome: "João Silva"
   - Telefone: "+55 11 99999-9999"
   - Título: "Como foi seu dia?"
   - Hora: 9h
   - Checklist: ["Trabalho", "Academia", "Estudos"]
   ↓
4. Ao sair do campo telefone:
   - Sistema normaliza: "5511999999999"
   - Chama /api/waha/validate-phone
   - WAHA valida e retorna chatId: "5511999999999@c.us"
   - Exibe check verde
   ↓
5. Clica "Criar Lead"
   ↓
6. Sistema valida todos os campos
   ↓
7. Cria registro em daily_user:
   {
     name: "João Silva",
     phone: "5511999999999@c.us",
     title: "Como foi seu dia?",
     time_to_send: 9,
     option: '["Trabalho", "Academia", "Estudos"]',
     is_admin: false,
     auth_user_id: null
   }
   ↓
8. Exibe mensagem de sucesso
   ↓
9. Administrador pode:
   - Criar outro usuário (formulário limpa)
   - Voltar para listagem
```

### 6.2 Fluxo de Vinculação de Conta

```
Cenário: Dar acesso de login a um usuário existente

1. Administrador acessa /edit?id=123
   ↓
2. Usuário não tem auth_user_id
   ↓
3. Seção "Vinculação com Autenticação" mostra:
   - Mensagem: "Este usuário não possui conta vinculada"
   - Dropdown com contas disponíveis
   ↓
4. Sistema carrega contas de auth.users:
   - Filtra apenas contas NÃO vinculadas
   - Lista ordenada por email
   ↓
5. Administrador seleciona: "joao@exemplo.com"
   ↓
6. Clica "Vincular Conta Selecionada"
   ↓
7. Sistema exibe confirmação
   ↓
8. Administrador confirma
   ↓
9. Sistema chama /api/admin/users/123/link-auth
   ↓
10. Endpoint:
    - Valida que admin está autenticado
    - Valida que auth_user_id existe
    - Verifica que não está vinculado a outro daily_user
    - Atualiza daily_user.auth_user_id = UUID
    ↓
11. Sucesso! Usuário agora pode fazer login com joao@exemplo.com
    ↓
12. Administrador pode (opcionalmente):
    - Alterar email
    - Definir nova senha temporária
    - Informar usuário sobre suas credenciais
```

### 6.3 Fluxo de Visualização de Dashboard

```
1. Usuário autenticado acessa /?id=5
   ↓
2. Sistema carrega:
   - daily_user WHERE id = 5
   - daily_data WHERE id_user = 5 (todas atividades)
   ↓
3. Em paralelo (assíncrono):
   - Busca perfil WhatsApp via /api/waha/profile
   - Foto, pushname, about
   ↓
4. Calcula estatísticas:
   - Total = 30 atividades
   - Concluídas = 24 (check_status = true)
   - Taxa = 80%
   ↓
5. Renderiza:
   - Cabeçalho com foto e dados do WhatsApp
   - 4 KPIs
   - Preview da enquete
   - Heatmap de evolução (14 dias)
   - Tabela de histórico
   ↓
6. Usuário pode:
   - Navegar pelo histórico
   - Ver detalhes de cada atividade
   - Clicar "Editar" (se tiver permissão)
```

### 6.4 Fluxo de Controle de Acesso (Middleware)

```
Usuário tenta acessar /edit?id=10

1. Middleware intercepta requisição
   ↓
2. Verifica autenticação:
   - Se não autenticado → redirect /login
   ↓
3. Se autenticado, busca daily_user:
   - SELECT id, is_admin FROM daily_user WHERE auth_user_id = {UUID}
   ↓
4. Verifica permissão:
   - Se is_admin = true → PERMITE
   - Se daily_user.id = 10 → PERMITE (próprio usuário)
   - Senão → redirect /users
   ↓
5. Se permitido, continua para página
   ↓
6. Página faz validação adicional via API
   ↓
7. Renderiza com ou sem seção administrativa
```

---

## 7. ARQUITETURA DO SISTEMA

### 7.1 Camadas da Aplicação

```
┌─────────────────────────────────────────┐
│         PRESENTATION LAYER              │
│  (Components, Pages, UI)                │
│  - Navbar, Forms, Cards, Tables         │
│  - AuthProvider (Context)               │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│         APPLICATION LAYER               │
│  (API Routes, Server Actions)           │
│  - /api/users/*                         │
│  - /api/admin/*                         │
│  - /api/waha/*                          │
│  - /api/auth/*                          │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│         BUSINESS LAYER                  │
│  (Repositories, Services, Utils)        │
│  - lib/supabase-admin.ts                │
│  - lib/supabase-server.ts               │
│  - lib/validations.ts                   │
│  - lib/waha.ts                          │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│         DATA LAYER                      │
│  - Supabase (PostgreSQL)                │
│  - auth.users                           │
│  - public.daily_user                    │
│  - public.daily_data                    │
└─────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────┐
│         EXTERNAL SERVICES               │
│  - WAHA (WhatsApp HTTP API)             │
│  - Supabase Auth                        │
│  - Supabase Storage (se usado)          │
└─────────────────────────────────────────┘
```

### 7.2 Estrutura de Diretórios

```
/daily
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── admin/                # Endpoints administrativos
│   │   │   ├── auth-users/       # Listar contas de auth
│   │   │   └── users/[id]/       # Operações por usuário
│   │   │       ├── link-auth/
│   │   │       ├── update-email/
│   │   │       ├── update-password/
│   │   │       └── update-role/
│   │   ├── auth/                 # Autenticação
│   │   │   ├── login/
│   │   │   └── logout/
│   │   ├── users/                # CRUD de usuários
│   │   └── waha/                 # Integração WhatsApp
│   │       ├── profile/
│   │       └── validate-phone/
│   ├── create/                   # Página de criação
│   ├── edit/                     # Página de edição
│   ├── login/                    # Página de login
│   ├── register/                 # Página de registro
│   ├── users/                    # Listagem de usuários
│   ├── layout.tsx                # Layout global
│   └── page.tsx                  # Dashboard (home)
│
├── components/                   # Componentes React
│   ├── ui/                       # Componentes base reutilizáveis
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── FormField.tsx
│   │   └── Input.tsx
│   ├── AdminUserFields.tsx       # Campos administrativos
│   ├── AuthProvider.tsx          # Context de autenticação
│   ├── DashboardContent.tsx      # Dashboard do usuário
│   ├── LeadManagement.tsx        # Gestão completa de leads
│   ├── Navbar.tsx                # Barra de navegação
│   ├── UserForm.tsx              # Formulário de usuário
│   └── UserList.tsx              # Lista de usuários
│
├── lib/                          # Bibliotecas e utilitários
│   ├── auth/                     # Helpers de autenticação
│   ├── repositories/             # Repositórios de dados
│   ├── hooks/                    # Custom hooks
│   ├── supabase.ts               # Cliente Supabase (anon)
│   ├── supabase-server.ts        # Cliente Supabase (server)
│   ├── supabase-admin.ts         # Cliente Supabase (service role)
│   ├── types.ts                  # Definições TypeScript
│   ├── validations.ts            # Funções de validação
│   └── waha.ts                   # Integração WAHA
│
├── supabase/                     # Migrações e configurações
│   └── migrations/               # SQL migrations
│       ├── 20260102000000_add_is_admin_field.sql
│       ├── 20260102000001_add_rls_policies.sql
│       └── 20260102000002_set_first_admin.sql
│
├── docs/                         # Documentação
│   └── ADMIN_USER_MANAGEMENT.md
│
├── public/                       # Assets estáticos
├── .env.local                    # Variáveis de ambiente (local)
├── .gitignore
├── next.config.js                # Configuração Next.js
├── package.json
├── README.md
├── tailwind.config.ts
└── tsconfig.json
```

### 7.3 Tecnologias e Dependências

#### Frontend
- **Next.js 14** - Framework React com App Router
- **React 18** - Biblioteca UI
- **TypeScript 5** - Tipagem estática
- **Tailwind CSS 3** - Framework CSS utilitário
- **lucide-react** - Ícones

#### Backend/Infraestrutura
- **Supabase** - BaaS (Backend as a Service)
  - PostgreSQL - Banco de dados
  - Auth - Autenticação
  - RLS - Row Level Security
- **WAHA** - WhatsApp HTTP API (integração externa)
- **Vercel** - Hospedagem (recomendado)

#### Bibliotecas
- `@supabase/ssr` - Server-Side Rendering com Supabase
- `@supabase/supabase-js` - Cliente JavaScript do Supabase

### 7.4 Variáveis de Ambiente

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... # ⚠️ NUNCA expor

# WAHA (WhatsApp HTTP API)
WAHA_BASE_URL=http://localhost:3000
WAHA_API_KEY=optional_api_key

# Next.js (opcional)
NEXT_PUBLIC_WAHA_URL=http://localhost:3000
```

**⚠️ IMPORTANTE:**
- `SUPABASE_SERVICE_ROLE_KEY` tem acesso total ao banco
- Nunca deve ser exposta no client-side
- Nunca deve ser commitada no Git
- Use apenas no backend (API Routes, Server Components)

---

## 8. SEGURANÇA

### 8.1 Camadas de Segurança

#### Camada 1: Row Level Security (RLS)
- Implementada no nível do banco de dados
- Políticas aplicadas automaticamente
- Funciona mesmo se outras camadas falharem

**Políticas em `daily_user`:**
```sql
-- SELECT: Todos autenticados podem ver todos
CREATE POLICY "Usuários podem visualizar todos os registros" 
ON public.daily_user FOR SELECT TO authenticated USING (true);

-- UPDATE: Admins ou próprio usuário
CREATE POLICY "Usuários podem atualizar apenas próprios dados ou admins tudo" 
ON public.daily_user FOR UPDATE TO authenticated
USING (
  (SELECT is_admin FROM public.daily_user WHERE auth_user_id = auth.uid()) = true
  OR auth_user_id = auth.uid()
);

-- INSERT: Apenas admins
CREATE POLICY "Apenas admins podem criar usuários" 
ON public.daily_user FOR INSERT TO authenticated
WITH CHECK (
  (SELECT is_admin FROM public.daily_user WHERE auth_user_id = auth.uid()) = true
);

-- DELETE: Apenas admins
CREATE POLICY "Apenas admins podem deletar usuários" 
ON public.daily_user FOR DELETE TO authenticated
USING (
  (SELECT is_admin FROM public.daily_user WHERE auth_user_id = auth.uid()) = true
);
```

#### Camada 2: API Validation
- Endpoints em `/api/admin/*` validam `is_admin`
- Função `isUserAdmin(authUserId)` verifica permissões
- Retorna 403 Forbidden se não autorizado

#### Camada 3: Middleware
- Intercepta requisições antes de chegar às páginas
- Valida autenticação
- Verifica permissões para rotas protegidas (ex: `/edit`)
- Redireciona usuários não autorizados

#### Camada 4: Client-Side Validation (UX)
- `AuthProvider` context fornece `canEdit(userId)`
- Botões/links só aparecem se usuário tem permissão
- Melhora experiência, mas não substitui validações server-side

### 8.2 Autenticação e Autorização

**Autenticação:**
- Gerenciada pelo Supabase Auth
- Login via email/senha
- Sessão armazenada em cookies HTTP-only
- Middleware valida sessão em todas as rotas protegidas

**Autorização:**
- Baseada em role: `is_admin` boolean
- Verificada em múltiplas camadas
- Admin = acesso total
- Não-Admin = acesso limitado aos próprios dados

### 8.3 Proteção de Dados Sensíveis

**Service Role Key:**
- Usada apenas em API Routes (server-side)
- Nunca enviada ao cliente
- Armazenada em variável de ambiente
- Bypass RLS (cuidado!)

**Senhas:**
- Nunca armazenadas em plain text
- Hash gerenciado pelo Supabase
- Não aparecem em logs
- Admin pode alterar sem saber a senha antiga

**Logs de Auditoria:**
```javascript
console.log(`[AUDIT] Admin ${authUser.email} (${authUser.id}) ${action} ${details}`)
```
- Todas operações administrativas são logadas
- Inclui: email, UUID, ação, detalhes
- Em produção, enviar para serviço externo (ex: Sentry, Datadog)

### 8.4 Validações de Input

**Frontend:**
- Validação em tempo real
- Feedback imediato ao usuário
- Previne envios inválidos

**Backend:**
- Validação robusta em API Routes
- Sanitização de inputs
- Proteção contra SQL Injection (Supabase ORM)
- Proteção contra XSS (React escapa por padrão)

### 8.5 HTTPS e Cookies

**Em Produção:**
- HTTPS obrigatório
- Cookies com flags `Secure`, `HttpOnly`, `SameSite`
- Headers de segurança configurados (CSP, etc)

---

## 9. CASOS DE USO DETALHADOS

### UC-001: Administrador Cria Novo Lead para WhatsApp

**Ator Principal:** Administrador  
**Objetivo:** Cadastrar um novo lead para receber enquetes diárias

**Pré-condições:**
- Administrador autenticado
- WAHA configurado e funcionando

**Fluxo Principal:**
1. Administrador acessa menu e clica "Usuários"
2. Na listagem, clica "Novo Usuário"
3. Sistema exibe formulário em 3 colunas:
   - Coluna 1: Dados pessoais (Nome, Telefone, Hora)
   - Coluna 2: (vazia em criação)
   - Coluna 3: Preview enquete WhatsApp
4. Administrador preenche:
   - Nome: "Maria Santos"
   - Telefone: "5521987654321"
5. Ao sair do campo telefone:
   - Sistema exibe "Validando..."
   - Chama WAHA
   - WAHA confirma número existe
   - Exibe check verde "✓ Válido no WhatsApp"
   - chatId salvo: "5521987654321@c.us"
6. Administrador continua:
   - Título: "Como foi seu dia hoje?"
   - Hora: 20h
7. Adiciona opções ao checklist:
   - Digita "⏰ Trabalho" → Enter
   - Digita "💪 Academia" → Enter
   - Digita "📚 Estudos" → Enter
   - Preview atualiza em tempo real
8. Clica "Criar Lead"
9. Sistema valida:
   - ✓ Telefone validado com WAHA
   - ✓ Todos campos preenchidos corretamente
10. Cria registro no banco
11. Exibe "Lead criado com sucesso!"
12. Formulário limpa para novo cadastro

**Fluxos Alternativos:**

**FA-1: Telefone Inválido**
- 5a. WAHA retorna "Número não encontrado"
- 5b. Sistema exibe erro vermelho
- 5c. Administrador corrige número
- Retorna ao passo 5

**FA-2: Telefone sem WhatsApp**
- 5a. Número existe mas não tem WhatsApp
- 5b. Sistema exibe "Número não encontrado no WhatsApp"
- 5c. Administrador corrige ou cancela

**Pós-condições:**
- Lead criado em `daily_user`
- Pode receber enquetes (via integração externa)
- Aparece na listagem de usuários

### UC-002: Administrador Dá Acesso ao Sistema para Lead

**Ator Principal:** Administrador  
**Objetivo:** Permitir que um lead faça login no sistema

**Pré-condições:**
- Administrador autenticado
- Lead existe em `daily_user` sem `auth_user_id`
- Conta de autenticação já existe em `auth.users`

**Fluxo Principal:**
1. Administrador acessa listagem de usuários
2. Encontra "Maria Santos" (ID: 42)
3. Clica "Editar"
4. Sistema exibe formulário de edição
5. Administrador rola até "Configurações Administrativas"
6. Vê seção "Vinculação com Autenticação"
7. Sistema mostra alerta amarelo:
   - "Este usuário não possui conta de autenticação vinculada"
8. Dropdown "Selecionar Usuário de Autenticação" exibe:
   - maria.santos@exemplo.com ✓
   - joao.silva@exemplo.com ✓
   - (apenas contas não vinculadas)
9. Administrador seleciona "maria.santos@exemplo.com"
10. Clica "Vincular Conta Selecionada"
11. Sistema exibe confirmação:
    - "Confirmar vinculação com: maria.santos@exemplo.com"
12. Administrador clica "Sim, Vincular"
13. Sistema:
    - Valida que maria.santos@exemplo.com existe
    - Valida que não está vinculada a outro usuário
    - Atualiza daily_user.auth_user_id = {UUID da Maria}
14. Exibe "Usuário de autenticação vinculado com sucesso"
15. Seção muda para verde:
    - "✓ Conta Vinculada"
    - "Email: maria.santos@exemplo.com"
16. Agora aparecem seções:
    - "Alterar Email"
    - "Alterar Senha"

**Fluxo Alternativo - Criar Nova Conta:**

**FA-1: Conta Não Existe**
1. Após passo 7, nenhuma conta disponível no dropdown
2. Administrador acessa Supabase Dashboard
3. Vai em Authentication > Users
4. Clica "Invite User" ou "Add User"
5. Cria conta: maria.santos@exemplo.com
6. Volta para edição do lead
7. Recarrega página
8. Agora conta aparece no dropdown
9. Continua do passo 9

**Pós-condições:**
- Maria pode fazer login com maria.santos@exemplo.com
- Acessa seu dashboard
- Pode editar seus próprios dados

### UC-003: Usuário Esqueceu a Senha

**Ator Principal:** Administrador  
**Objetivo:** Resetar senha de um usuário

**Pré-condições:**
- Administrador autenticado
- Usuário tem conta vinculada

**Fluxo Principal:**
1. Usuário "João" liga/contata administrador:
   - "Esqueci minha senha"
2. Administrador acessa `/users`
3. Encontra "João Silva" (ID: 10)
4. Clica "Editar"
5. Rola até "Configurações Administrativas"
6. Seção "Alterar Senha" está visível (usuário vinculado)
7. Preenche:
   - Nova Senha: "SenhaTemp123!"
   - Confirmar: "SenhaTemp123!"
8. Clica "Atualizar Senha"
9. Sistema exibe confirmação
10. Administrador confirma
11. Sistema:
    - Valida senha (mínimo 8 caracteres)
    - Valida que senhas coincidem
    - Chama Supabase Admin API
    - Atualiza senha em auth.users
12. Exibe "Senha atualizada com sucesso"
13. Administrador informa João por canal seguro:
    - WhatsApp: "Sua nova senha é SenhaTemp123!"
    - "Por favor, troque a senha no primeiro login"
14. João faz login com nova senha
15. (Opcional) João acessa perfil e troca senha

**Regras:**
- Administrador não precisa saber senha antiga
- Senha antiga para de funcionar imediatamente
- Sem fluxo de confirmação por email (operação administrativa)

**Pós-condições:**
- João tem nova senha funcional
- Pode fazer login normalmente

### UC-004: Visualizar Dashboard de Usuário

**Ator Principal:** Qualquer usuário autenticado  
**Objetivo:** Ver estatísticas e atividades de um usuário

**Pré-condições:**
- Usuário autenticado

**Fluxo Principal:**
1. Usuário acessa `/?id=5`
2. Sistema valida autenticação (middleware)
3. Carrega dados:
   - `daily_user` WHERE id = 5
   - `daily_data` WHERE id_user = 5
4. Em paralelo (assíncrono):
   - Busca perfil WhatsApp (foto, nome, status)
5. Renderiza cabeçalho:
   - Foto de perfil (se disponível)
   - Nome: "Carlos Oliveira"
   - Pushname: "Carlão 🎯"
   - About: "Foco, força e fé"
   - Telefone: 5511988887777
   - Badge verde "Ativo"
6. Renderiza 4 KPIs:
   - **Taxa de Conclusão:** 85%
     - Barra verde (>80%)
   - **Total de Atividades:** 40
   - **Dias Concluídos:** 34
     - Badge "Performance positiva"
   - **Próximo Envio:** 09:00
     - Ícone relógio
7. Renderiza Preview Enquete (estilo WhatsApp):
   - Fundo escuro
   - Header verde com ícone WhatsApp
   - Título: "Como foi seu dia?"
   - 3 opções:
     - ⏰ Trabalho
     - 💪 Academia
     - 📚 Estudos
   - Footer: "3 opções | 🕐 09:00"
8. Renderiza Heatmap Evolução (14 dias):
   - Grid: 3 linhas (opções) x 14 colunas (dias)
   - Células verdes = concluído
   - Células vermelhas = não concluído
   - Células cinza = sem registro
9. Renderiza Histórico:
   - Tabela com todas as 40 atividades
   - Ordenado por data decrescente
   - Colunas: Data, Opção, Status, Criado em
10. Usuário pode:
    - Rolar pela página
    - Analisar padrões
    - Clicar "Editar" (se tiver permissão)

**Fluxo Alternativo - Sem Atividades:**
- Passo 6-9: Exibe estado vazio
- "Nenhuma atividade registrada para este usuário"

**Pós-condições:**
- Usuário entende desempenho do lead
- Pode tomar decisões baseadas em dados

---

## 10. VALIDAÇÕES E CONSTRAINTS

### 10.1 Validações de Campos

#### Nome
- **Tipo:** string
- **Obrigatório:** Não
- **Mínimo:** 2 caracteres (se preenchido)
- **Máximo:** 100 caracteres
- **Validação:** `validateName(name)`
- **Mensagem de erro:** "Nome deve ter no mínimo 2 caracteres" ou "Nome deve ter no máximo 100 caracteres"

#### Título
- **Tipo:** string
- **Obrigatório:** Não
- **Mínimo:** 2 caracteres (se preenchido)
- **Máximo:** 100 caracteres
- **Validação:** `validateTitle(title)`
- **Mensagem de erro:** "Título deve ter no mínimo 2 caracteres" ou "Título deve ter no máximo 100 caracteres"

#### Telefone
- **Tipo:** string
- **Obrigatório:** Sim (em criação/edição com mudança)
- **Formato:** Regex `^\+?[1-9]\d{9,14}$`
- **Validação Adicional:** WAHA `check-exists`
- **Armazenamento:** chatId completo (ex: `5511999999999@c.us`)
- **Exibição:** Sem @c.us (ex: `5511999999999`)
- **Validação:** `validatePhone(phone)` + WAHA
- **Mensagens:**
  - "Formato de telefone inválido. Use o formato: +55 11 99999-9999 ou similar"
  - "Número não encontrado no WhatsApp"
  - "Por favor, saia do campo de telefone para validar o número no WhatsApp"

#### Hora de Envio
- **Tipo:** string no form ("HH:mm"), integer no banco (0-23)
- **Obrigatório:** Não
- **Formato:** `HH:mm` (ex: "09:00", "23:00")
- **Validação:** Regex `^([0-1][0-9]|2[0-3]):[0-5][0-9]$`
- **Conversão:** Extrai hora: `parseInt(time.split(':')[0])`
- **Validação:** `validateSendTime(time)`
- **Mensagem de erro:** "Formato de hora inválido. Use o formato HH:mm (ex: 14:30)"

#### Checklist
- **Tipo:** array de strings (form), string JSON (banco)
- **Obrigatório:** Não
- **Mínimo:** 0 itens
- **Máximo por item:** 200 caracteres
- **Formato no banco:** `'["item1", "item2"]'`
- **Validação:** `validateChecklist(items)`
- **Mensagens:**
  - "Item X do checklist não pode estar vazio"
  - "Item X do checklist deve ter no máximo 200 caracteres"

### 10.2 Constraints de Banco de Dados

#### daily_user
- `id` BIGINT PRIMARY KEY AUTO INCREMENT
- `phone` UNIQUE (permite null)
- `auth_user_id` UNIQUE (permite null)
- `is_admin` NOT NULL DEFAULT false
- `created_at` NOT NULL DEFAULT now()
- FK: `auth_user_id` → `auth.users.id`

#### daily_data
- `id` BIGINT PRIMARY KEY AUTO INCREMENT
- `id_user` NOT NULL
- `activity_date` NOT NULL DEFAULT CURRENT_DATE
- `check_status` DEFAULT false
- `created_at` NOT NULL DEFAULT now()
- FK: `id_user` → `daily_user.id`

### 10.3 Regras de Unicidade

1. **Telefone Único:**
   - Apenas um `daily_user` pode ter determinado telefone
   - Constraint: UNIQUE em `phone`
   - Erro: "duplicate key value violates unique constraint"

2. **Auth User Único:**
   - Apenas um `daily_user` pode estar vinculado a um `auth_user_id`
   - Constraint: UNIQUE em `auth_user_id`
   - Validação adicional em `/api/admin/users/[id]/link-auth`

3. **Email Único (auth.users):**
   - Gerenciado pelo Supabase Auth
   - Erro: "User already registered"

---

## 11. MENSAGENS E FEEDBACK AO USUÁRIO

### 11.1 Mensagens de Sucesso

| Ação | Mensagem | Tipo | Duração |
|------|----------|------|---------|
| Lead criado | "Lead criado com sucesso!" | Success (verde) | 3s |
| Lead atualizado | "Lead atualizado com sucesso!" | Success (verde) | 3s |
| Permissões alteradas | "Usuário promovido a administrador com sucesso" | Success (verde) | 5s |
| Conta vinculada | "Usuário de autenticação vinculado com sucesso" | Success (verde) | 5s |
| Conta desvinculada | "Usuário de autenticação desvinculado com sucesso" | Success (verde) | 5s |
| Email atualizado | "Email atualizado com sucesso" | Success (verde) | 5s |
| Senha atualizada | "Senha atualizada com sucesso" | Success (verde) | 5s |
| Login bem-sucedido | (Redirecionamento silencioso) | - | - |
| Logout bem-sucedido | (Redirecionamento para /login) | - | - |

### 11.2 Mensagens de Erro

| Situação | Mensagem | Tipo |
|----------|----------|------|
| Telefone inválido | "Formato de telefone inválido. Use o formato: +55 11 99999-9999 ou similar" | Error (vermelho) |
| Telefone não existe WhatsApp | "Número não encontrado no WhatsApp. Verifique se o número está correto." | Error (vermelho) |
| Telefone não validado | "Por favor, saia do campo de telefone para validar o número no WhatsApp" | Error (vermelho) |
| Nome muito curto | "Nome deve ter no mínimo 2 caracteres" | Error (vermelho) |
| Título muito longo | "Título deve ter no máximo 100 caracteres" | Error (vermelho) |
| Checklist vazio | "Checklist é obrigatório. Adicione pelo menos um item." | Error (vermelho) |
| Item checklist vazio | "Item X do checklist não pode estar vazio" | Error (vermelho) |
| Sem permissão | "Apenas administradores podem..." | Error (vermelho) |
| Não autenticado | "Você precisa fazer login" | Error (vermelho) |
| Usuário não encontrado | "Usuário não encontrado. Verifique se o ID na URL está correto" | Error (vermelho) |
| Email em uso | "Este email já está em uso" | Error (vermelho) |
| Senha não coincide | "As senhas não coincidem" | Error (vermelho) |
| Senha muito curta | "A senha deve ter no mínimo 8 caracteres" | Error (vermelho) |
| Auth user já vinculado | "Este usuário de autenticação já está vinculado a outro usuário" | Error (vermelho) |
| WAHA não configurado | "URL do WAHA não configurada. Configure WAHA_BASE_URL no arquivo .env.local" | Error (vermelho) |

### 11.3 Estados de Loading

| Componente | Mensagem | Visual |
|------------|----------|--------|
| Lista de usuários | "Carregando usuários..." | Spinner centralizado |
| Dashboard | "Carregando dados do usuário..." | Spinner centralizado |
| Validando telefone | "Validando..." | Ícone girando no campo |
| Salvando lead | "Criando lead..." / "Salvando..." | Overlay escuro + spinner |
| Atualizando permissões | "Processando..." | Botão desabilitado |
| Vinculando conta | "Vinculando..." | Botão desabilitado |
| Atualizando email | "Atualizando..." | Botão desabilitado |
| Atualizando senha | "Atualizando..." | Botão desabilitado |
| Login | "Entrando..." | Botão desabilitado |

### 11.4 Confirmações

| Ação | Mensagem | Botões |
|------|----------|--------|
| Deletar usuário | "Tem certeza que deseja excluir este lead?" | Sim, Não |
| Alterar permissões | "⚠️ Tem certeza que deseja [ação]?" | Sim Confirmar, Cancelar |
| Desvincular conta | "Tem certeza que deseja desvincular este usuário de autenticação?" | OK, Cancelar |
| Alterar email | "Tem certeza que deseja alterar o email para [novo email]?" | OK, Cancelar |
| Alterar senha | "Tem certeza que deseja alterar a senha deste usuário?" | OK, Cancelar |

---

## 12. INTEGRAÇÕES EXTERNAS

### 12.1 WAHA (WhatsApp HTTP API)

**Base URL:** Configurável via `WAHA_BASE_URL`  
**Autenticação:** Header `X-Api-Key` (opcional)

#### Endpoints Utilizados:

**1. Validar Número**
```
GET /api/contacts/check-exists?phone={number}&session=default
```
**Parâmetros:**
- `phone`: Número sem formatação (ex: 5511999999999)
- `session`: "default"

**Resposta:**
```json
{
  "numberExists": true,
  "chatId": "5511999999999@c.us"
}
```

**Uso no Sistema:**
- Chamado em `/api/waha/validate-phone`
- Validação obrigatória antes de salvar telefone

**2. Buscar Foto de Perfil**
```
GET /api/contacts/profile-picture?contactId={chatId}&session=default
```

**Resposta:**
```json
{
  "profilePictureURL": "https://...",
  "url": "https://..."
}
```

**3. Buscar About/Status**
```
GET /api/contacts/about?contactId={chatId}&session=default
```

**Resposta:**
```json
{
  "about": "Foco, força e fé",
  "status": "Foco, força e fé"
}
```

**4. Buscar Dados do Contato**
```
GET /api/contacts?contactId={chatId}&session=default
```

**Resposta:**
```json
{
  "pushname": "João Silva",
  "id": "5511999999999@c.us",
  ...
}
```

**Uso no Sistema:**
- Chamados em `/api/waha/profile`
- 3 requisições paralelas com `Promise.all()`
- Exibição no dashboard

#### Tratamento de Erros:

**Cenários:**
1. **WAHA Offline:**
   - Retorna erro genérico
   - Sistema funciona com funcionalidades limitadas
   - Dashboard não exibe dados do WhatsApp

2. **Número Não Existe:**
   - `numberExists: false`
   - Bloqueia criação/edição do usuário

3. **Timeout:**
   - Após 3s sem resposta
   - Trata como erro de conexão

### 12.2 Supabase

#### Supabase Database (PostgreSQL)
- CRUD em `daily_user` e `daily_data`
- Queries via cliente oficial
- RLS aplicado automaticamente

#### Supabase Auth
- Login/Logout
- Gerenciamento de sessões
- Admin API para operações administrativas:
  - `auth.admin.listUsers()`
  - `auth.admin.getUserById(uuid)`
  - `auth.admin.updateUserById(uuid, {...})`

#### Segurança:
- **Anon Key:** Cliente público (RLS aplicado)
- **Service Role Key:** Admin client (bypass RLS)

---

## 13. DEPLOY E CONFIGURAÇÃO

### 13.1 Configuração Inicial

#### Passo 1: Clonar Repositório
```bash
git clone <repo-url>
cd daily
npm install
```

#### Passo 2: Configurar Variáveis de Ambiente
Criar `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ... # ⚠️ Obrigatório
WAHA_BASE_URL=http://localhost:3000
WAHA_API_KEY=optional
```

#### Passo 3: Executar Migrações SQL
1. Acessar Supabase Dashboard > SQL Editor
2. Executar scripts em ordem:
   - `supabase/migrations/20260102000000_add_is_admin_field.sql`
   - `supabase/migrations/20260102000001_add_rls_policies.sql`
   - `supabase/migrations/20260102000002_set_first_admin.sql`

#### Passo 4: Definir Primeiro Administrador
```sql
-- Opção 1: Por ID
UPDATE public.daily_user 
SET is_admin = true 
WHERE id = 1;

-- Opção 2: Por email vinculado
UPDATE public.daily_user 
SET is_admin = true 
WHERE auth_user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'admin@exemplo.com'
);
```

#### Passo 5: Iniciar Desenvolvimento
```bash
npm run dev
```

Acesse: http://localhost:3000

### 13.2 Deploy em Produção (Vercel)

#### Passo 1: Conectar Repositório
- Acessar Vercel Dashboard
- Importar projeto do GitHub/GitLab
- Vercel detecta Next.js automaticamente

#### Passo 2: Configurar Variáveis de Ambiente
Em Settings > Environment Variables:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=... # ⚠️ Nunca commitar
WAHA_BASE_URL=...
WAHA_API_KEY=...
```

#### Passo 3: Deploy
```bash
npm run build # Vercel faz automaticamente
vercel --prod
```

#### Passo 4: Configurar Domínio (Opcional)
- Settings > Domains
- Adicionar domínio customizado

### 13.3 Configuração do WAHA

#### Opção 1: Docker Local
```bash
docker run -d \
  --name waha \
  -p 3000:3000 \
  -e WAHA_API_KEY=sua_chave \
  devlikeapro/whatsapp-http-api
```

#### Opção 2: Cloud
- Usar serviço gerenciado
- Configurar webhook (se necessário)
- Atualizar `WAHA_BASE_URL`

### 13.4 Checklist de Deploy

- [ ] Variáveis de ambiente configuradas
- [ ] Migrações SQL executadas
- [ ] Primeiro admin definido
- [ ] WAHA configurado e acessível
- [ ] HTTPS habilitado
- [ ] Domínio configurado (opcional)
- [ ] Service Role Key segura (não commitada)
- [ ] Logs de auditoria configurados (produção)
- [ ] Backup do banco configurado

---

## 14. MANUTENÇÃO E OPERAÇÃO

### 14.1 Logs e Monitoramento

#### Logs de Auditoria
Todas operações administrativas geram logs:
```javascript
[AUDIT] Admin admin@exemplo.com (uuid-123) promoveu usuário 10 a administrador
[AUDIT] Admin admin@exemplo.com (uuid-123) vinculou auth_user uuid-456 ao usuário 10
[AUDIT] Admin admin@exemplo.com (uuid-123) alterou email do usuário 10
```

**Recomendações para Produção:**
- Enviar para serviço externo (Sentry, Datadog, Logtail)
- Armazenar em banco separado
- Implementar rotação de logs
- Alertas para ações críticas

#### Monitoramento de Erros
- Configurar Sentry ou similar
- Alertas para erros 500
- Monitorar taxa de falha de validação WAHA
- Acompanhar latência de requisições

### 14.2 Backup e Recuperação

#### Backup do Banco (Supabase)
- **Automático:** Supabase faz backups diários (plano pago)
- **Manual:** 
  1. Dashboard > Database > Backups
  2. Download SQL dump
  3. Armazenar em local seguro

#### Dados Críticos:
- `daily_user`: Lista de leads e configurações
- `daily_data`: Histórico de atividades
- `auth.users`: Contas de autenticação

### 14.3 Tarefas Administrativas Comuns

#### Listar Todos Admins
```sql
SELECT id, name, phone, auth_user_id, created_at 
FROM public.daily_user 
WHERE is_admin = true 
ORDER BY created_at DESC;
```

#### Usuários Vinculados vs Não Vinculados
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

#### Verificar Vinculação Duplicada (Não Deveria Existir)
```sql
SELECT auth_user_id, COUNT(*) as total
FROM public.daily_user 
WHERE auth_user_id IS NOT NULL
GROUP BY auth_user_id
HAVING COUNT(*) > 1;
```

#### Buscar Usuário por Email
```sql
SELECT du.*, au.email
FROM public.daily_user du
LEFT JOIN auth.users au ON du.auth_user_id = au.id
WHERE au.email = 'usuario@exemplo.com';
```

#### Promover Usuário via SQL
```sql
UPDATE public.daily_user 
SET is_admin = true 
WHERE id = 10;
```

### 14.4 Troubleshooting

#### "Apenas administradores podem..."
**Problema:** Usuário não tem permissão  
**Solução:**
```sql
UPDATE public.daily_user 
SET is_admin = true 
WHERE auth_user_id = (
  SELECT id FROM auth.users 
  WHERE email = 'seu-email@exemplo.com'
);
```

#### "Este email já está em uso"
**Problema:** Email duplicado em auth.users  
**Solução:**
1. Verificar em Authentication > Users
2. Deletar conta duplicada (se erro)
3. Ou escolher outro email

#### "SUPABASE_SERVICE_ROLE_KEY não configurado"
**Problema:** Variável de ambiente não definida  
**Solução:**
1. Adicionar ao `.env.local`
2. Reiniciar servidor: `npm run dev`
3. Em produção: configurar na Vercel

#### Campos Administrativos Não Aparecem
**Verificações:**
1. Logado como admin?
2. Na página de edição (`/edit?id=X`)?
3. Campo `is_admin` está true?

```sql
SELECT id, name, is_admin, auth_user_id 
FROM public.daily_user 
WHERE auth_user_id = 'seu-uuid';
```

---

## 15. MELHORIAS FUTURAS

### 15.1 Funcionalidades Planejadas

1. **Envio Automático de Enquetes**
   - Scheduler para enviar mensagens via WAHA
   - Configuração de horário por usuário
   - Fila de mensagens

2. **Sistema de Notificações**
   - Email para administradores
   - Alertas de baixa performance
   - Resumos semanais

3. **Relatórios e Analytics**
   - Gráficos de tendência
   - Comparação entre usuários
   - Exportação para PDF/Excel

4. **Níveis de Permissão Intermediários**
   - Moderador
   - Visualizador
   - Personalização de permissões

5. **Webhook para N8N**
   - Notificações em tempo real
   - Integração com automações

6. **Aplicativo Móvel**
   - React Native
   - Notificações push
   - Acesso offline

7. **Multi-idioma (i18n)**
   - Inglês
   - Espanhol
   - Configuração por usuário

### 15.2 Melhorias Técnicas

1. **Testes Automatizados**
   - Jest para testes unitários
   - Cypress para testes E2E
   - Cobertura mínima 80%

2. **CI/CD**
   - GitHub Actions
   - Deploy automático
   - Testes antes de merge

3. **Otimizações de Performance**
   - Paginação na listagem de usuários
   - Lazy loading de imagens
   - Cache de dados do WhatsApp

4. **Acessibilidade**
   - Suporte a leitores de tela
   - Navegação por teclado completa
   - WCAG AAA

5. **SEO e Meta Tags**
   - Open Graph
   - Twitter Cards
   - Sitemap

---

## 16. GLOSSÁRIO

| Termo | Definição |
|-------|-----------|
| **Admin** | Usuário com permissões de administrador (`is_admin = true`) |
| **Auth User** | Conta de autenticação no Supabase Auth (`auth.users`) |
| **Chat ID** | Identificador do WhatsApp no formato `número@c.us` |
| **Checklist** | Lista de opções da enquete, armazenada como JSON |
| **Daily Data** | Registro de atividade diária em `daily_data` |
| **Daily User** | Usuário/lead cadastrado em `daily_user` |
| **Lead** | Termo usado no sistema para usuário que receberá enquetes |
| **Middleware** | Função que intercepta requisições antes de chegar às páginas |
| **Pushname** | Nome exibido no perfil do WhatsApp |
| **RLS** | Row Level Security - Políticas de segurança em nível de linha no banco |
| **Service Role Key** | Chave administrativa do Supabase com acesso total (bypass RLS) |
| **WAHA** | WhatsApp HTTP API - Serviço para integração com WhatsApp |

---

## 17. REFERÊNCIAS

### Documentação Oficial
- [Next.js 14 Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
- [WAHA Documentation](https://waha.devlike.pro/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [TypeScript](https://www.typescriptlang.org/docs/)
- [React](https://react.dev/)

### Arquivos do Projeto
- `README.md` - Visão geral e setup
- `docs/ADMIN_USER_MANAGEMENT.md` - Guia de gestão administrativa
- `supabase/migrations/README.md` - Como executar migrações

---

## 18. CONTROLE DE VERSÕES DO DOCUMENTO

| Versão | Data | Autor | Alterações |
|--------|------|-------|------------|
| 1.0 | 04/01/2026 | Sistema | Criação inicial do documento |

---

## 19. APROVAÇÕES

| Papel | Nome | Data | Assinatura |
|-------|------|------|-----------|
| Product Owner | - | - | - |
| Tech Lead | - | - | - |
| QA Lead | - | - | - |

---

**Fim do Documento**

*Gerado automaticamente com base na análise completa do código-fonte do sistema Daily Status Dashboard*
