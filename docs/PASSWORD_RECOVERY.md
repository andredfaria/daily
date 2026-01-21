# Guia de Recuperação de Senha

Este documento descreve o fluxo de recuperação de senha implementado no sistema.

## Visão Geral

O sistema utiliza o Supabase Auth para gerenciar recuperação de senha, enviando emails com links seguros para redefinição.

## Fluxo Completo

### 1. Usuário Solicita Recuperação

1. Usuário acessa `/forgot-password`
2. Preenche email
3. Clica em "Enviar link de recuperação"
4. Sistema envia POST para `/api/auth/forgot-password`

### 2. Envio de Email

O endpoint `/api/auth/forgot-password`:

1. Valida email
2. Chama `supabase.auth.resetPasswordForEmail(email, { redirectTo })`
3. Supabase envia email com link de reset
4. Link contém token temporário válido por 1 hora

### 3. Usuário Redefine Senha

1. Usuário clica no link do email
2. É redirecionado para `/reset-password?token=...`
3. Preenche nova senha e confirmação
4. Sistema valida token e atualiza senha
5. Redireciona para `/login`

## Configuração

### URL de Redirecionamento

O sistema configura automaticamente a URL de redirecionamento:

```typescript
const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const redirectTo = `${origin}/reset-password`
```

### Configurar Email no Supabase

1. Acesse Supabase Dashboard
2. Vá em **Authentication → Email Templates**
3. Configure template de "Reset Password"
4. Use variável `{{ .ConfirmationURL }}` para o link

**Template Sugerido:**

```html
<h2>Redefinir Senha</h2>
<p>Clique no link abaixo para redefinir sua senha:</p>
<p><a href="{{ .ConfirmationURL }}">Redefinir Senha</a></p>
<p>Este link expira em 1 hora.</p>
```

## Variáveis de Ambiente

```env
NEXT_PUBLIC_APP_URL=https://seu-dominio.com
```

## Segurança

### Validação de Token

O token no link é validado automaticamente pelo Supabase Auth. Tokens:
- São únicos por solicitação
- Expiram em 1 hora
- São de uso único (invalidados após uso)

### Proteção contra Email Harvesting

Por segurança, o endpoint retorna sucesso mesmo se email não existir:

```typescript
if (error) {
  // Retornar sucesso mesmo se email não existir (por segurança)
  return NextResponse.json({
    message: 'Se o email existir, você receberá um link...',
  })
}
```

## Páginas

### `/forgot-password`

Página para solicitar recuperação:
- Formulário com campo de email
- Validação de formato
- Link para voltar ao login

### `/reset-password`

Página para redefinir senha:
- Formulário com nova senha e confirmação
- Validação: mínimo 6 caracteres
- Senhas devem coincidir
- Validação visual em tempo real

## Validações

### No Frontend

- Email deve ter formato válido
- Senha mínima: 6 caracteres
- Confirmação deve coincidir com senha

### No Backend

- Token deve ser válido e não expirado
- Senha mínima: 6 caracteres (validado pelo Supabase)

## Testes

### Testar Fluxo Completo

1. Acesse `/forgot-password`
2. Digite um email válido
3. Verifique caixa de entrada
4. Clique no link do email
5. Redefina senha
6. Faça login com nova senha

### Emails de Teste

Para desenvolvimento, use email de teste do Supabase:
- Vá em **Authentication → Email Templates → Settings**
- Configure **Redirect URLs** para incluir `http://localhost:3000`

## Personalização

### Customizar Template de Email

1. Acesse Supabase Dashboard
2. Vá em **Authentication → Email Templates**
3. Selecione "Reset Password"
4. Customize HTML, texto e variáveis disponíveis

### Variáveis Disponíveis

- `{{ .ConfirmationURL }}`: Link completo para reset
- `{{ .Email }}`: Email do usuário
- `{{ .SiteURL }}`: URL do site

## Troubleshooting

### Email não está sendo enviado

- Verifique configuração de SMTP no Supabase
- Verifique pasta de spam
- Confirme que email está cadastrado no sistema

### Link expirado

- Links expiram em 1 hora
- Solicite novo link se expirado
- Verifique configuração de expiração no Supabase

### Token inválido

- Verifique se URL completa foi copiada
- Confirme que token não foi usado anteriormente
- Verifique se não expirou

## Segurança Adicional

### Rate Limiting

Considere adicionar rate limiting no endpoint `/api/auth/forgot-password`:

```typescript
// Limitar a 3 tentativas por hora por IP
const rateLimit = // implementar rate limiting
```

### Logs

Todos os pedidos de reset são logados para auditoria:

```typescript
console.log('[PASSWORD RESET] Solicitação para:', email)
```
