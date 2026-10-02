import pool from '../db'
import {
  SESSAO_DIAS_SEM_USO,
  SESSAO_RENOVA_MINUTOS,
  gerarTokenSessao,
  hashTokenSessao,
  limitarUserAgent,
} from './sessionToken'

export async function criarSessao(userId: string, userAgent: unknown): Promise<string> {
  const token = gerarTokenSessao()
  await pool.query(
    `INSERT INTO sessions (id, user_id, token_hash, user_agent, expires_at)
     VALUES (UUID(), ?, ?, ?, DATE_ADD(NOW(), INTERVAL ${SESSAO_DIAS_SEM_USO} DAY))`,
    [userId, hashTokenSessao(token), limitarUserAgent(userAgent)]
  )
  // Limpeza oportunista: sessão vencida não tem mais uso.
  await pool.query(`DELETE FROM sessions WHERE expires_at < NOW()`).catch(() => {})
  return token
}

export async function validarSessao(
  token: string,
  userAgent: unknown
): Promise<{ sessionId: string; userId: string } | null> {
  const [rows]: any = await pool.query(
    `SELECT id, user_id FROM sessions WHERE token_hash = ? AND expires_at > NOW() LIMIT 1`,
    [hashTokenSessao(token)]
  )
  if (!rows.length) return null

  // Prazo deslizante: uso renova os 90 dias. O filtro em last_used_at segura a
  // escrita a uma por hora por dispositivo.
  await pool.query(
    `UPDATE sessions
        SET last_used_at = NOW(),
            expires_at = DATE_ADD(NOW(), INTERVAL ${SESSAO_DIAS_SEM_USO} DAY),
            user_agent = COALESCE(?, user_agent)
      WHERE id = ? AND last_used_at < DATE_SUB(NOW(), INTERVAL ${SESSAO_RENOVA_MINUTOS} MINUTE)`,
    [limitarUserAgent(userAgent), rows[0].id]
  )

  return { sessionId: rows[0].id, userId: rows[0].user_id }
}
