export interface MissState {
  misses: number
  shouldLock: boolean
}

export const INACTIVITY_THRESHOLD = 3

// Dado o contador de dias seguidos sem resposta e o resultado do poll mais
// recente já encerrado, calcula o novo contador e se o limiar foi atingido.
export function nextMissState(
  previousMisses: number,
  lastCompletedCount: number,
  threshold = INACTIVITY_THRESHOLD,
): MissState {
  const misses = lastCompletedCount > 0 ? 0 : previousMisses + 1
  return { misses, shouldLock: misses >= threshold }
}

// Aviso de pausa por inatividade. O limiar entra pelo parâmetro em vez de ficar
// cravado no texto — a versão anterior dizia "15 dias" e continuou dizendo
// depois que o número mudou. Só o checklist é pausado: os lembretes de contas
// seguem, e dizer isso evita que o usuário ache que perdeu os vencimentos.
export function buildInactivityMessage(
  checklistName: string,
  threshold = INACTIVITY_THRESHOLD,
): string {
  return (
    `Seu checklist *${checklistName}* ficou ${threshold} dias sem resposta, ` +
    `então pausamos o envio dele. Seus lembretes de contas continuam normalmente. ` +
    `Para voltar a receber, reative em Checklists no BillSync.`
  )
}
