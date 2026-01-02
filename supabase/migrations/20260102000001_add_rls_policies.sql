-- Migration: Add Row Level Security policies for daily_user table
-- Created: 2026-01-02
-- Description: Implementa políticas de segurança em nível de linha para controlar acesso à tabela daily_user

-- Habilitar RLS na tabela daily_user (caso não esteja habilitado)
ALTER TABLE public.daily_user ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes caso já existam
DROP POLICY IF EXISTS "Usuários podem visualizar todos os registros" ON public.daily_user;
DROP POLICY IF EXISTS "Usuários podem atualizar apenas próprios dados ou admins tudo" ON public.daily_user;
DROP POLICY IF EXISTS "Apenas admins podem criar usuários" ON public.daily_user;
DROP POLICY IF EXISTS "Apenas admins podem deletar usuários" ON public.daily_user;

-- Policy para SELECT: todos usuários autenticados podem visualizar todos os registros
CREATE POLICY "Usuários podem visualizar todos os registros" 
ON public.daily_user 
FOR SELECT 
TO authenticated
USING (true);

-- Policy para UPDATE: apenas admins ou o próprio usuário pode atualizar
CREATE POLICY "Usuários podem atualizar apenas próprios dados ou admins tudo" 
ON public.daily_user 
FOR UPDATE 
TO authenticated
USING (
  -- Permite se for admin
  (SELECT is_admin FROM public.daily_user WHERE auth_user_id = auth.uid()) = true
  -- OU se estiver editando seus próprios dados
  OR auth_user_id = auth.uid()
)
WITH CHECK (
  -- Mesma lógica para o CHECK
  (SELECT is_admin FROM public.daily_user WHERE auth_user_id = auth.uid()) = true
  OR auth_user_id = auth.uid()
);

-- Policy para INSERT: apenas admins podem criar novos usuários
CREATE POLICY "Apenas admins podem criar usuários" 
ON public.daily_user 
FOR INSERT 
TO authenticated
WITH CHECK (
  (SELECT is_admin FROM public.daily_user WHERE auth_user_id = auth.uid()) = true
);

-- Policy para DELETE: apenas admins podem deletar usuários
CREATE POLICY "Apenas admins podem deletar usuários" 
ON public.daily_user 
FOR DELETE 
TO authenticated
USING (
  (SELECT is_admin FROM public.daily_user WHERE auth_user_id = auth.uid()) = true
);

-- Comentário para documentação
COMMENT ON TABLE public.daily_user IS 'Tabela de usuários do sistema Daily com RLS habilitado para controle de acesso baseado em roles';
