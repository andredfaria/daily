-- Migration: Set first admin user
-- Created: 2026-01-02
-- Description: Define o primeiro usuário como administrador
-- IMPORTANTE: Este script deve ser executado manualmente ou ajustado conforme necessário

-- Define o primeiro usuário criado como admin
-- Ajuste a condição WHERE conforme necessário para o seu caso
UPDATE public.daily_user 
SET is_admin = true 
WHERE id = (SELECT id FROM public.daily_user ORDER BY created_at ASC LIMIT 1)
AND is_admin = false;

-- Alternativa: definir admin por email específico (descomente e ajuste se necessário)
-- UPDATE public.daily_user 
-- SET is_admin = true 
-- WHERE auth_user_id IN (
--   SELECT id FROM auth.users WHERE email = 'seu-email@exemplo.com'
-- );
