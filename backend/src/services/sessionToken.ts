import { createHash, randomBytes } from 'crypto'

// Sessão expira depois de tanto tempo sem uso; cada requisição empurra o prazo.
export const SESSAO_DIAS_SEM_USO = 90

// Renovar a cada requisição seria um UPDATE por chamada à API. Uma vez por hora
// basta: o erro máximo no prazo de 90 dias é de uma hora.
export const SESSAO_RENOVA_MINUTOS = 60

// Token opaco de 256 bits. Não é JWT: o que vale é a linha em `sessions`, então
// apagar a linha derruba o dispositivo na hora.
export function gerarTokenSessao(): string {
  return randomBytes(32).toString('base64url')
}

// O banco guarda só o hash — um dump de `sessions` não serve para entrar.
// SHA-256 sem sal é suficiente porque o token já tem 256 bits de entropia.
export function hashTokenSessao(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

// JWT de 30 dias emitido antes das sessões: três partes separadas por ponto.
// O token opaco é base64url, que não tem ponto.
export function ehTokenLegado(token: string): boolean {
  return token.split('.').length === 3
}

export function limitarUserAgent(ua: unknown): string | null {
  if (typeof ua !== 'string' || !ua.trim()) return null
  return ua.trim().slice(0, 255)
}
