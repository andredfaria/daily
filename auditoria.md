  Relatório de Auditoria: Projeto Daily Status


  Este relatório detalha as inconsistências e oportunidades de
  melhoria identificadas no projeto, priorizando a manutenção da
  integridade técnica e do design system estabelecido.

  ---


  1. Inconsistências de Design

  ┌────────────────┬───────────┬────────┬──────────────────────┐
  │ Problema       │ Severidad │ Esforç │ Sugestão de Correção │
  │                │ e         │ o      │                      │
  ├────────────────┼───────────┼────────┼──────────────────────┤
  │ **Duplicação   │ Média     │ Baixo  │ Centralizar todas as │
  │ de Tokens      │           │        │ cores e espaçamentos │
  │ CSS**          │           │        │ no                   │
  │                │           │        │ tailwind.config.ts │
  │                │           │        │ .                    │
  │ **Redundância  │ Baixa     │ Baixo  │ Unificar a classe    │
  │ de             │           │        │ .glass-card do CSS │
  │ Glassmorphism* │           │        │ com a variante       │
  │ *              │           │        │ glass do           │
  │                │           │        │ componente Card.   │
  │ **Uso de Cores │ Média     │ Baixo  │ Substituir           │
  │ Hardcoded**    │           │        │ utilitários como     │
  │                │           │        │ bg-slate-950 por   │
  │                │           │        │ tokens semânticos    │
  │                │           │        │ como                 │
  │                │           │        │ bg-background.     │
  └────────────────┴───────────┴────────┴──────────────────────┘



  2. Código Duplicado

  ┌────────────┬───────────┬────────┬───────────────────────────┐
  │ Problema   │ Severidad │ Esforç │ Sugestão de Correção      │
  │            │ e         │ o      │                           │
  ├────────────┼───────────┼────────┼───────────────────────────┤
  │ **Múltiplo │ Alta      │ Médio  │ Consolidar endpoints      │
  │ s          │           │        │ /update-email,          │
  │ Endpoints  │           │        │ /update-password, etc., │
  │ de         │           │        │ em uma única rota         │
  │ Update**   │           │        │ PATCH.                  │
  │ **Lógica   │ Alta      │ Médio  │ Criar um serviço          │
  │ de         │           │        │ centralizado em           │
  │ Assinatura │           │        │ `lib/utils/subscription.t │
  │ Repetida** │           │        │ s` para processar         │
  │            │           │        │ webhooks de               │
  │            │           │        │ Stripe/Hotmart.           │
  │ **Validaçã │ Baixa     │ Baixo  │ Usar a função             │
  │ o de Email │           │        │ isValidEmail de         │
  │ Manual**   │           │        │ lib/validations.ts em   │
  │            │           │        │ vez de Regex inline nas   │
  │            │           │        │ rotas.                    │
  └────────────┴───────────┴────────┴───────────────────────────┘



  3. Padrões Quebrados

  ┌───────────────┬───────────┬────────┬───────────────────────┐
  │ Problema      │ Severidad │ Esforç │ Sugestão de Correção  │
  │               │ e         │ o      │                       │
  ├───────────────┼───────────┼────────┼───────────────────────┤
  │ **Arquivos    │ Baixa     │ Baixo  │ Remover               │
  │ "Stub" do     │           │        │ lib/supabase.ts e   │
  │ Supabase**    │           │        │ `lib/supabase-admin.t │
  │               │           │        │ s` para evitar        │
  │               │           │        │ confusão de           │
  │               │           │        │ onboarding.           │
  │ **Configuraçõ │ Baixa     │ Baixo  │ Remover               │
  │ es Órfãs**    │           │        │ lib/swr-config.ts,  │
  │               │           │        │ já que o projeto não  │
  │               │           │        │ utiliza a biblioteca  │
  │               │           │        │ SWR.                  │
  │ **Middleware  │ Média     │ Baixo  │ Unificar a lógica de  │
  │ de Auth       │           │        │ lib/auth-jwt.ts e   │
  │ Múltiplo**    │           │        │ lib/server-auth.ts  │
  │               │           │        │ em um único provedor  │
  │               │           │        │ de utilitários de     │
  │               │           │        │ sessão.               │
  └───────────────┴───────────┴────────┴───────────────────────┘



  4. Features Fora de Escopo / Dead Code

  ┌────────────────┬────────────┬─────────┬───────────────────┐
  │ Problema       │ Severidade │ Esforço │ Sugestão de       │
  │                │            │         │ Correção          │
  ├────────────────┼────────────┼─────────┼───────────────────┤
  │ **Schema SQL   │ Baixa      │ Baixo   │ Remover asaas e │
  │ com Provedores │            │         │ mercadopago do  │
  │ Extras**       │            │         │ ENUM do MySQL se  │
  │                │            │         │ não houver plano  │
  │                │            │         │ de implementação  │
  │                │            │         │ imediata.         │
  │ **Endpoints de │ Média      │ Médio   │ Remover rotas de  │
  │ Admin          │            │         │ API que apenas    │
  │ Fragmentados** │            │         │ chamam funções de │
  │                │            │         │ lib/db/ sem     │
  │                │            │         │ adicionar lógica  │
  │                │            │         │ extra de          │
  │                │            │         │ segurança.        │
  └────────────────┴────────────┴─────────┴───────────────────┘



  5. Dependências Desnecessárias / Faltantes

  ┌────────────────┬────────────┬─────────┬────────────────────┐
  │ Problema       │ Severidade │ Esforço │ Sugestão de        │
  │                │            │         │ Correção           │
  ├────────────────┼────────────┼─────────┼────────────────────┤
  │ **SWR Ausente  │ Média      │ Baixo   │ Instalar swr ou  │
  │ no             │            │         │ remover os         │
  │ package.json** │            │         │ arquivos de        │
  │                │            │         │ configuração       │
  │                │            │         │ relacionados.      │
  │ **Lucide React │ Baixa      │ Baixo   │ Atualizar a versão │
  │ Version**      │            │         │ do lucide-react  │
  │                │            │         │ para evitar bugs   │
  │                │            │         │ de tipos em        │
  │                │            │         │ componentes novos. │
  └────────────────┴────────────┴─────────┴────────────────────┘



  6. Problemas de Performance

  ┌──────────────┬────────────┬─────────┬──────────────────────┐
  │ Problema     │ Severidade │ Esforço │ Sugestão de Correção │
  ├──────────────┼────────────┼─────────┼──────────────────────┤
  │ **Fetching   │ Média      │ Médio   │ Implementar          │
  │ Client-side  │            │         │ loading.tsx do     │
  │ Excessivo**  │            │         │ Next.js 14 em vez de │
  │              │            │         │ gerenciar estados de │
  │              │            │         │ loading manuais    │
  │              │            │         │ via useState.      │
  │ **Re-renders │ Baixa      │ Médio   │ Utilizar             │
  │ em           │            │         │ React.memo em      │
  │ Listagens**  │            │         │ componentes de linha │
  │              │            │         │ da ActivityTable   │
  │              │            │         │ para grandes volumes │
  │              │            │         │ de dados.            │
  │ **Conexões   │ Alta       │ Baixo   │ Garantir o uso de    │
  │ MySQL**      │            │         │ Connection Pool (já  │
  │              │            │         │ presente, mas        │
  │              │            │         │ verificar limites em │
  │              │            │         │ ambiente de          │
  │              │            │         │ produção).           │
  └──────────────┴────────────┴─────────┴──────────────────────┘

  ---


  Nota Final: O projeto está bem estruturado para uma migração
  recente de stack, mas sofre de "débito técnico de transição"
  (arquivos antigos mantidos como stubs). A maior prioridade deve
  ser a unificação das rotas de administração para reduzir a
  superfície de manutenção.