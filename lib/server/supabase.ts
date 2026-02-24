/**
 * lib/server/supabase.ts — DEPRECATED
 * 
 * Este arquivo existia para criar um cliente Supabase para Server Components.
 * O sistema agora usa MySQL diretamente via lib/mysql.ts e lib/db/*.
 * Este stub existe apenas para evitar quebras em imports que ainda não foram atualizados.
 */

export const createServerSupabaseClient = async () => {
    throw new Error(
        'createServerSupabaseClient foi removido. Use lib/db/daily_user.ts ou lib/mysql.ts diretamente.'
    )
}
