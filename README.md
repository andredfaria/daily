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
NEXT_PUBLIC_WAHA_URL=http://localhost:3000
```

3. Execute o servidor de desenvolvimento:

```bash
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) no navegador.

## Estrutura do Projeto

- `app/` - Páginas e layouts do Next.js (App Router)
- `components/` - Componentes React reutilizáveis
- `lib/` - Utilitários e configurações (Supabase, tipos TypeScript)

## Funcionalidades

- Dashboard de usuário com estatísticas de atividades
- Criação de novos usuários com checklist dinâmico
- Listagem de usuários cadastrados
- Edição de usuários com validação em tempo real
- Validação de telefone usando WAHA (WhatsApp HTTP API)
- Integração com Supabase para armazenamento de dados
- Webhook para notificações (n8n)

## Validações

- **Título**: Opcional, mínimo 2 caracteres, máximo 100 caracteres
- **Telefone**: Opcional, validação de formato e verificação via WAHA `/api/contacts/check-exists`
- **Hora de Envio**: Opcional, formato HH
- **Checklist**: Obrigatorio, mínimo 1 item, máximo 50 itens
