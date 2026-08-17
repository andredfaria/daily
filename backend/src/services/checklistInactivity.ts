export interface MissState {
  misses: number
  shouldLock: boolean
}

// Dado o contador de dias seguidos sem resposta e o resultado do poll mais
// recente já encerrado, calcula o novo contador e se o limiar foi atingido.
export function nextMissState(
  previousMisses: number,
  lastCompletedCount: number,
  threshold = 15,
): MissState {
  const misses = lastCompletedCount > 0 ? 0 : previousMisses + 1
  return { misses, shouldLock: misses >= threshold }
}
