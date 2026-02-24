/**
 * lib/supabase-server.ts — STUB DE COMPATIBILIDADE
 * 
 * Este arquivo existia para criar clientes Supabase em Server Components.
 * O sistema agora usa JWT via lib/server-auth.ts e MySQL via lib/db/*.
 * 
 * Use:
 *   import { getUser, getCurrentDailyUser } from '@/lib/server-auth'
 */

export async function getUser() {
  throw new Error(
    'getUser de supabase-server foi removido. Use getCurrentDailyUser ou getSession de lib/server-auth.ts'
  )
}
