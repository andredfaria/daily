import { createClient } from '@supabase/supabase-js'
import { UserMetadata } from '@/lib/types'

/**
 * Cliente Supabase com Service Role Key
 * 
 * ATENÇÃO: Este cliente tem acesso total ao banco de dados e IGNORA RLS.
 * Use apenas em operações administrativas no backend.
 * NUNCA exponha a Service Role Key no client-side.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL não configurado')
  }

  if (!supabaseServiceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurado')
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Verifica se o usuário autenticado é administrador
 * @param authUserId - UUID do usuário autenticado
 * @returns true se o usuário é admin, false caso contrário
 */
export async function isUserAdmin(authUserId: string): Promise<boolean> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('daily_user')
    .select('is_admin')
    .eq('auth_user_id', authUserId)
    .single()

  if (error || !data) {
    return false
  }

  return data.is_admin === true
}

/**
 * Busca informações do daily_user pelo auth_user_id
 * @param authUserId - UUID do usuário autenticado
 */
export async function getDailyUserByAuthId(authUserId: string) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('daily_user')
    .select('*')
    .eq('auth_user_id', authUserId)
    .single()

  if (error) {
    throw error
  }

  return data
}

/**
 * Atualiza o campo is_admin de um usuário
 * @param userId - ID do daily_user
 * @param isAdmin - Novo valor para is_admin
 */
export async function updateUserAdminStatus(userId: number, isAdmin: boolean) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('daily_user')
    .update({ is_admin: isAdmin })
    .eq('id', userId)
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}

/**
 * Vincula ou desvincula um auth_user_id de um daily_user
 * @param userId - ID do daily_user
 * @param authUserId - UUID do auth_user ou null para desvincular
 */
export async function linkAuthUser(userId: number, authUserId: string | null) {
  const supabase = createAdminClient()

  // Se está vinculando, verificar se o auth_user existe
  if (authUserId) {
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(authUserId)
    
    if (authError || !authUser) {
      throw new Error('Usuário de autenticação não encontrado')
    }

    // Verificar se esse auth_user_id já está vinculado a outro daily_user
    const { data: existingLink } = await supabase
      .from('daily_user')
      .select('id')
      .eq('auth_user_id', authUserId)
      .neq('id', userId)
      .single()

    if (existingLink) {
      throw new Error('Este usuário de autenticação já está vinculado a outro usuário')
    }
  }

  const { data, error } = await supabase
    .from('daily_user')
    .update({ auth_user_id: authUserId })
    .eq('id', userId)
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}

/**
 * Atualiza o email de um usuário via Admin API
 * @param authUserId - UUID do auth_user
 * @param newEmail - Novo email
 */
export async function updateUserEmail(authUserId: string, newEmail: string) {
  const supabase = createAdminClient()

  const { data, error } = await supabase.auth.admin.updateUserById(authUserId, {
    email: newEmail,
  })

  if (error) {
    throw error
  }

  return data
}

/**
 * Atualiza a senha de um usuário via Admin API
 * @param authUserId - UUID do auth_user
 * @param newPassword - Nova senha
 */
export async function updateUserPassword(authUserId: string, newPassword: string) {
  const supabase = createAdminClient()

  const { data, error } = await supabase.auth.admin.updateUserById(authUserId, {
    password: newPassword,
  })

  if (error) {
    throw error
  }

  return data
}

/**
 * Lista todos os usuários do Supabase Auth
 * @param page - Número da página (padrão: 1)
 * @param perPage - Itens por página (padrão: 1000)
 */
export async function listAuthUsers(page: number = 1, perPage: number = 1000) {
  const supabase = createAdminClient()

  const { data, error } = await supabase.auth.admin.listUsers({
    page,
    perPage,
  })

  if (error) {
    throw error
  }

  return data.users
}

/**
 * Garante que um usuário auth.users tenha um daily_user vinculado
 * - Se não existir, cria um novo daily_user
 * - Configura automaticamente subscription_status, is_admin e trial_ends_at
 * @param authUserId - UUID do usuário autenticado
 * @param userMetadata - Dados opcionais do usuário (nome, telefone) do auth.users.user_metadata
 * @returns daily_user vinculado
 */
export async function ensureDailyUserLink(authUserId: string, userMetadata?: UserMetadata) {
  const supabase = createAdminClient()

  try {
    // Verificar se auth_user existe
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(authUserId)
    
    if (authError || !authUser) {
      throw new Error(`Usuário de autenticação não encontrado: ${authUserId}`)
    }

    // Buscar daily_user existente
    const { data: existingDailyUser, error: fetchError } = await supabase
      .from('daily_user')
      .select('*')
      .eq('auth_user_id', authUserId)
      .single()

    // Se encontrou, retornar
    if (existingDailyUser && !fetchError) {
      console.log(`[ensureDailyUserLink] daily_user já existe para auth_user_id: ${authUserId}`)
      return existingDailyUser
    }

    // Se não encontrou, criar novo daily_user
    console.log(`[ensureDailyUserLink] Criando daily_user para auth_user_id: ${authUserId}`)

    // Extrair dados do user_metadata ou auth.user
    const name = userMetadata?.name || authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'Usuário'
    const phone = userMetadata?.phone || authUser.user_metadata?.phone || null

    // Calcular trial_ends_at (7 dias a partir de agora)
    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + 7)

    // Criar daily_user
    const { data: newDailyUser, error: createError } = await supabase
      .from('daily_user')
      .insert({
        auth_user_id: authUserId,
        name: name,
        phone: phone,
        subscription_status: 'trial',
        is_admin: false,
        trial_ends_at: trialEndsAt.toISOString(),
      })
      .select()
      .single()

    if (createError) {
      console.error('[ensureDailyUserLink] Erro ao criar daily_user:', createError)
      throw new Error(`Erro ao criar daily_user: ${createError.message}`)
    }

    console.log(`[ensureDailyUserLink] daily_user criado com sucesso: ${newDailyUser.id}`)
    return newDailyUser
  } catch (error) {
    console.error('[ensureDailyUserLink] Erro:', error)
    throw error
  }
}
