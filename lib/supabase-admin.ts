/**
 * lib/supabase-admin.ts — STUB DE COMPATIBILIDADE
 * 
 * Este arquivo existia para exportar o cliente Supabase Admin.
 * O sistema agora usa MySQL diretamente via lib/db/daily_user.ts
 * 
 * ⚠️ ATENÇÃO: Remova qualquer import deste arquivo e use os equivalentes MySQL.
 * 
 * Funções equivalentes no novo sistema:
 * - isUserAdmin()      → import { getDailyUserById } from '@/lib/db/daily_user'
 * - updateUserEmail()  → import { updateUserEmail } from '@/lib/db/daily_user'
 * - updateUserPassword() → import { updateUserPassword } from '@/lib/db/daily_user'
 * - listAuthUsers()    → import { listDailyUsers } from '@/lib/db/daily_user'
 */

export function createAdminClient(): never {
  throw new Error(
    'createAdminClient foi removido. Use lib/db/daily_user.ts para operações de banco de dados.'
  )
}

export async function isUserAdmin(): Promise<boolean> {
  throw new Error('isUserAdmin foi removido. Use getDailyUserById de lib/db/daily_user.ts')
}
