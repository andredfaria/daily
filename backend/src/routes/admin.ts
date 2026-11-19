import { Router, Request, Response } from 'express'
import pool from '../db'
import { KINDS_ATIVIDADE } from '../services/activityLog'
import { inicioDoDiaSP, inicioDoMesSP, inicioDoProximoMesSP } from '../services/adminDatas'

const router = Router()

const KINDS: readonly string[] = KINDS_ATIVIDADE
const STATUS = ['ok', 'falha', 'ignorado']

function lerMeta(meta: any): any {
  if (typeof meta !== 'string') return meta ?? null
  try { return JSON.parse(meta) } catch { return null }
}

function linhaAtividade(r: any) {
  return { ...r, meta: lerMeta(r.meta) }
}

// Último acesso: maior entre o uso de sessão e os eventos acesso/login do log.
const SESSAO_MAX = `(SELECT MAX(s.last_used_at) FROM sessions s WHERE s.user_id = u.id)`
const LOG_MAX = `(SELECT MAX(a.created_at) FROM activity_log a WHERE a.user_id = u.id AND a.kind IN ('acesso','login'))`
// COALESCE cruzado: sem sentinela em texto, o resultado continua DATETIME (e NULL se não houver nada).
const ULTIMO_ACESSO = `GREATEST(COALESCE(${SESSAO_MAX}, ${LOG_MAX}), COALESCE(${LOG_MAX}, ${SESSAO_MAX}))`

const COLUNAS_USUARIO = `
  u.id, u.name, u.whatsapp_number, u.created_at, u.is_admin,
  ${ULTIMO_ACESSO} AS ultimo_acesso,
  (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id AND s.expires_at > NOW()) AS sessoes_ativas,
  (SELECT COUNT(*) FROM activity_log a WHERE a.user_id = u.id AND a.kind = 'login' AND a.created_at >= NOW() - INTERVAL 30 DAY) AS logins_30d,
  (SELECT COUNT(*) FROM activity_log a WHERE a.user_id = u.id AND a.kind = 'comando' AND a.created_at >= NOW() - INTERVAL 30 DAY) AS comandos_30d,
  (SELECT COUNT(*) FROM activity_log a WHERE a.user_id = u.id AND a.kind = 'msg_enviada' AND a.created_at >= NOW() - INTERVAL 30 DAY) AS mensagens_30d,
  (SELECT COUNT(*) FROM activity_log a WHERE a.user_id = u.id AND a.status = 'falha' AND a.created_at >= NOW() - INTERVAL 30 DAY) AS falhas_30d,
  (SELECT COUNT(*) FROM bills b WHERE b.user_id = u.id AND b.is_active = 1) AS contas_ativas,
  (SELECT COUNT(*) FROM expenses e WHERE e.user_id = u.id AND e.spent_on >= ? AND e.spent_on < ?) AS gastos_mes,
  (SELECT COUNT(*) FROM assets x WHERE x.user_id = u.id AND x.is_active = 1) AS ativos,
  (SELECT COUNT(*) FROM checklists c WHERE c.user_id = u.id AND c.is_active = 1) AS checklists`

const SELECT_ATIVIDADE = `
  SELECT a.id, a.user_id, u.name AS user_name, a.kind, a.status, a.ref, a.detail, a.error, a.meta, a.created_at
  FROM activity_log a LEFT JOIN users u ON u.id = a.user_id`

// Limites do mês de São Paulo para o `gastos_mes` (spent_on é DATE).
const paramsMes = () => [inicioDoMesSP(), inicioDoProximoMesSP()]

// GET /api/admin/overview?horas=24
router.get('/overview', async (req: Request, res: Response) => {
  try {
    const horas = Math.min(Math.max(parseInt(String(req.query.horas), 10) || 24, 1), 24 * 90)
    const eu = req.userId as string

    // Usuários ativos numa janela: sessão usada ou acesso/login no log, sem admins.
    const ativosEm = (intervalo: string) => `
      SELECT COUNT(*) AS total FROM users u
      WHERE u.is_admin = 0 AND u.id <> ?
        AND ${ULTIMO_ACESSO} >= NOW() - INTERVAL ${intervalo}`

    const [falhas, a24, a7, a30, enviadas, ultimas] = await Promise.all([
      pool.query(
        `SELECT kind, ref, COUNT(*) AS total FROM activity_log
         WHERE status = 'falha' AND created_at >= NOW() - INTERVAL ? HOUR
         GROUP BY kind, ref ORDER BY total DESC`,
        [horas]),
      pool.query(ativosEm('24 HOUR'), [eu]),
      pool.query(ativosEm('7 DAY'), [eu]),
      pool.query(ativosEm('30 DAY'), [eu]),
      pool.query(
        `SELECT COUNT(*) AS total FROM activity_log
         WHERE kind = 'msg_enviada' AND status = 'ok' AND created_at >= ?`, [inicioDoDiaSP()]),
      pool.query(
        `${SELECT_ATIVIDADE} WHERE a.status = 'falha' ORDER BY a.id DESC LIMIT 20`),
    ])

    res.json({
      falhasPorTipo: (falhas[0] as any[]).map(r => ({ kind: r.kind, ref: r.ref, total: Number(r.total) })),
      ativos: {
        h24: Number((a24[0] as any)[0].total),
        d7: Number((a7[0] as any)[0].total),
        d30: Number((a30[0] as any)[0].total),
      },
      enviadasHoje: Number((enviadas[0] as any)[0].total),
      ultimasFalhas: (ultimas[0] as any[]).map(linhaAtividade),
    })
  } catch (err: any) {
    console.error('[admin] overview:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// GET /api/admin/users
router.get('/users', async (_req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT ${COLUNAS_USUARIO} FROM users u ORDER BY ultimo_acesso DESC`, paramsMes())
    res.json(rows)
  } catch (err: any) {
    console.error('[admin] users:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// GET /api/admin/users/:id
router.get('/users/:id', async (req: Request, res: Response) => {
  try {
    const [[usuarios], [sessoes]]: any = await Promise.all([
      pool.query(
        `SELECT ${COLUNAS_USUARIO}, u.whatsapp_alerts_enabled, u.notification_time, u.summary_enabled
         FROM users u WHERE u.id = ? LIMIT 1`, [...paramsMes(), req.params.id]),
      pool.query(
        `SELECT id, user_agent, created_at, last_used_at FROM sessions
         WHERE user_id = ? AND expires_at > NOW() ORDER BY last_used_at DESC`, [req.params.id]),
    ])
    const usuario = usuarios[0]
    if (!usuario) return res.status(404).json({ error: 'Usuário não encontrado' })
    res.json({ ...usuario, sessoes })
  } catch (err: any) {
    console.error('[admin] user:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// GET /api/admin/activity?user_id=&kind=a,b&status=&antes_de=&limite=50
router.get('/activity', async (req: Request, res: Response) => {
  try {
    const limite = Math.min(Math.max(parseInt(String(req.query.limite), 10) || 50, 1), 200)
    const where: string[] = []
    const params: any[] = []

    if (typeof req.query.user_id === 'string' && req.query.user_id) {
      where.push('a.user_id = ?'); params.push(req.query.user_id)
    }
    if (typeof req.query.kind === 'string' && req.query.kind) {
      const kinds = req.query.kind.split(',').map(k => k.trim()).filter(k => KINDS.includes(k))
      if (kinds.length) {
        where.push(`a.kind IN (${kinds.map(() => '?').join(',')})`); params.push(...kinds)
      }
    }
    if (typeof req.query.status === 'string' && STATUS.includes(req.query.status)) {
      where.push('a.status = ?'); params.push(req.query.status)
    }
    const antes = parseInt(String(req.query.antes_de), 10)
    if (antes > 0) { where.push('a.id < ?'); params.push(antes) }

    const [rows]: any = await pool.query(
      `${SELECT_ATIVIDADE} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY a.id DESC LIMIT ?`,
      [...params, limite + 1])

    const temMais = rows.length > limite
    const itens = rows.slice(0, limite).map(linhaAtividade)
    res.json({ itens, proximo: temMais ? itens[itens.length - 1].id : null })
  } catch (err: any) {
    console.error('[admin] activity:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router
