-- Migration: Add is_admin field to daily_user table
-- Created: 2026-01-02
-- Description: Adiciona campo is_admin para controle de permissões de usuários

-- Adicionar campo is_admin à tabela daily_user
ALTER TABLE public.daily_user 
ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- Criar índice para otimizar consultas de verificação de admin
CREATE INDEX IF NOT EXISTS idx_daily_user_is_admin ON public.daily_user(is_admin);

-- Criar índice para auth_user_id (caso não exista) para otimizar joins
CREATE INDEX IF NOT EXISTS idx_daily_user_auth_user_id ON public.daily_user(auth_user_id);

-- Comentários para documentação
COMMENT ON COLUMN public.daily_user.is_admin IS 'Flag que indica se o usuário possui permissões de administrador';
