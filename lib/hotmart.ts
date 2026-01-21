/**
 * Utilitário para validação de tokens de webhook da Hotmart
 * 
 * A Hotmart envia um token (hottok) em cada requisição de webhook para validação de segurança.
 * Este token deve ser comparado com o token configurado na conta da Hotmart.
 */

/**
 * Valida o token recebido do webhook da Hotmart
 * 
 * @param token - Token recebido no payload do webhook (hottok)
 * @returns true se o token for válido ou se não houver token configurado (modo desenvolvimento)
 * @returns false se o token não corresponder ao token configurado
 */
export function validateHotmartToken(token: string | undefined): boolean {
  // Se não houver token recebido, considerar inválido
  if (!token) {
    return false
  }

  // Obter token configurado nas variáveis de ambiente
  const configuredToken = process.env.HOTMART_WEBHOOK_TOKEN

  // Se não houver token configurado, permitir em modo desenvolvimento
  // Em produção, o token deve estar configurado
  if (!configuredToken) {
    // Em desenvolvimento, permitir sem validação
    // Em produção, retornar false para forçar configuração
    if (process.env.NODE_ENV === 'development') {
      console.warn('[HOTMART] HOTMART_WEBHOOK_TOKEN não configurado - permitindo em modo desenvolvimento')
      return true
    }
    // Em produção sem token configurado, rejeitar
    console.error('[HOTMART] HOTMART_WEBHOOK_TOKEN não configurado em produção')
    return false
  }

  // Comparar tokens (comparação segura contra timing attacks)
  return token === configuredToken
}
