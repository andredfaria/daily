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

export function decidirAcessoAdmin(
  user: { is_admin: number | boolean; whatsapp_number: string } | null,
  adminEnv: string | undefined,
): boolean {
  if (!user) return false
  if (user.is_admin) return true
  return ehNumeroAdmin(user.whatsapp_number, adminEnv)
}

const TTL_MS = 60_000
const cache = new Map<string, { valor: boolean; expira: number }>()

export async function usuarioEhAdmin(userId: string): Promise<boolean> {
  const agora = Date.now()
  const hit = cache.get(userId)
  if (hit && hit.expira > agora) return hit.valor
  const [rows]: any = await pool.query(
    'SELECT is_admin, whatsapp_number FROM users WHERE id = ? LIMIT 1',
    [userId],
  )
  const valor = decidirAcessoAdmin(rows[0] ?? null, process.env.ADMIN_WHATSAPP)
  cache.set(userId, { valor, expira: agora + TTL_MS })
  return valor
}
