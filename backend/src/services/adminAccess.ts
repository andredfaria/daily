import pool from '../db'

/** Variantes do número com e sem o 9º dígito (55 + DDD + 8 ou 9 dígitos). */
function variantes(numero: string): string[] {
  const d = (numero || '').replace(/\D/g, '')
  if (!d) return []
  const out = [d]
  if (d.startsWith('55')) {
    if (d.length === 12) out.push(`${d.slice(0, 4)}9${d.slice(4)}`)
    else if (d.length === 13 && d[4] === '9') out.push(`${d.slice(0, 4)}${d.slice(5)}`)
  }
  return out
}

export function ehNumeroAdmin(numero: string, adminEnv: string | undefined): boolean {
  if (!adminEnv) return false
  const admin = variantes(adminEnv)
  if (!admin.length) return false
  return variantes(numero).some(v => admin.includes(v))
}

/**
 * Em requisição, admin é só a coluna users.is_admin. O número do WhatsApp é editável
 * sem verificação em PATCH /users/me, então nunca decide acesso aqui; o fallback
 * ADMIN_WHATSAPP só vale no login por OTP (número provado), em routes/auth.ts.
 */
export function decidirAcessoAdmin(user: { is_admin: number | boolean } | null): boolean {
  return !!user && !!user.is_admin
}

const TTL_MS = 60_000
const cache = new Map<string, { valor: boolean; expira: number }>()

export async function usuarioEhAdmin(userId: string): Promise<boolean> {
  const agora = Date.now()
  const hit = cache.get(userId)
  if (hit && hit.expira > agora) return hit.valor
  const [rows]: any = await pool.query(
    'SELECT is_admin FROM users WHERE id = ? LIMIT 1',
    [userId],
  )
  const valor = decidirAcessoAdmin(rows[0] ?? null)
  cache.set(userId, { valor, expira: agora + TTL_MS })
  return valor
}
