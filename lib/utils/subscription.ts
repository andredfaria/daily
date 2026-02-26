import { SubscriptionUpdateData } from '@/lib/types'
import { updateDailyUser } from '@/lib/db/daily_user'

/**
 * Lógica de assinatura que depende de bibliotecas de servidor (MySQL).
 * Este arquivo DEVE ser usado apenas em Server Components ou API Routes.
 */

// Re-exporta utilitários que não dependem de DB para conveniência no server
export * from './subscription-utils'

/**
 * Centraliza a lógica de atualização de assinatura para webhooks
 * 
 * @param userId - ID do usuário no MySQL
 * @param data - Dados parciais de assinatura vindos do provedor
 */
export async function updateSubscriptionStatus(
  userId: number,
  data: SubscriptionUpdateData
): Promise<void> {
  // Garante que o objeto de dados está limpo para o banco (MySQL)
  const updateData: Record<string, unknown> = { ...data as unknown as Record<string, unknown> }
  
  // Realiza a atualização no banco de dados
  await updateDailyUser(userId, updateData)
  
  console.log(`[SUBSCRIPTION SERVICE] Usuário ${userId} atualizado:`, JSON.stringify(data))
}
