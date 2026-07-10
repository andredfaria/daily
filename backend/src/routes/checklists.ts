import { Router, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import pool from '../db'
import { sendDailyPoll, getTodaySaoPaulo } from '../services/checklistDispatcher'
import { computeItemStats } from '../services/checklistStats'

const router = Router()

// -------- Helpers --------

async function getAllChecklists(userId: string) {
  const [rows]: any = await pool.query(
    'SELECT id, user_id, name, send_time, recurrence_type, recurrence_days, timezone, is_active, created_at, updated_at FROM checklists WHERE user_id = ? ORDER BY created_at ASC',
    [userId],
  )
  return rows as any[]
}

async function getChecklistById(id: string, userId: string) {
  const [rows]: any = await pool.query(
    'SELECT id, user_id, name, send_time, recurrence_type, recurrence_days, timezone, is_active, created_at, updated_at FROM checklists WHERE id = ? AND user_id = ?',
    [id, userId],
  )
  if (!rows.length) return null
  return rows[0]
}

async function getMostRecentChecklist(userId: string) {
  const [rows]: any = await pool.query(
    `SELECT c.id, c.user_id, c.name, c.send_time, c.recurrence_type, c.recurrence_days, c.timezone, c.is_active, c.created_at, c.updated_at
     FROM checklists c
     LEFT JOIN checklist_daily_polls cdp ON cdp.checklist_id = c.id
     WHERE c.user_id = ?
     GROUP BY c.id
     ORDER BY MAX(cdp.poll_date) DESC, c.created_at ASC
     LIMIT 1`,
    [userId],
  )
  if (!rows.length) return null
  return rows[0]
}

async function getItems(checklistId: string) {
  const [rows]: any = await pool.query(
    'SELECT id, checklist_id, text, sort_order FROM checklist_items WHERE checklist_id = ? ORDER BY sort_order ASC',
    [checklistId],
  )
  return rows
}

// -------- GET /api/checklists - retorna todos os checklists do usuário --------
router.get('/', async (req: Request, res: Response) => {
  try {
    const checklists = await getAllChecklists(req.userId!)
    for (const c of checklists) {
      c.items = await getItems(c.id)
    }
    res.json(checklists)
  } catch (err: any) {
    console.error('[checklists] GET /', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// -------- POST /api/checklists - cria checklist com itens --------
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, send_time, timezone, recurrence_type, recurrence_days, items } = req.body

    if (!items || !Array.isArray(items) || items.length < 2 || items.length > 12) {
      return res.status(400).json({ error: 'Checklist deve ter entre 2 e 12 itens.' })
    }

    const texts = items.map((i: any) => i.text?.trim()).filter(Boolean)
    if (texts.length < 2 || texts.length > 12) {
      return res.status(400).json({ error: 'Checklist deve ter entre 2 e 12 itens com texto.' })
    }
    if (new Set(texts.map((t: string) => t.toLowerCase())).size !== texts.length) {
      return res.status(400).json({ error: 'Itens duplicados não são permitidos.' })
    }

    const rType = recurrence_type || 'daily'
    const rDays = recurrence_days ? JSON.stringify(recurrence_days) : null

    const checklistId = uuidv4()
    await pool.query(
      'INSERT INTO checklists (id, user_id, name, send_time, recurrence_type, recurrence_days, timezone) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [checklistId, req.userId!, name || 'Checklist Diário', send_time ?? 9, rType, rDays, timezone || 'America/Sao_Paulo'],
    )

    const itemValues = texts.map((text: string, i: number) => [uuidv4(), checklistId, text, i])
    await pool.query(
      'INSERT INTO checklist_items (id, checklist_id, text, sort_order) VALUES ?',
      [itemValues],
    )

    const checklist = await getChecklistById(checklistId, req.userId!)
    checklist.items = await getItems(checklistId)
    res.status(201).json(checklist)
  } catch (err: any) {
    console.error('[checklists] POST /', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// -------- PUT /api/checklists/:id - atualiza checklist e itens --------
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const [ownership]: any = await pool.query(
      'SELECT id FROM checklists WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId!],
    )
    if (!ownership.length) return res.status(404).json({ error: 'Checklist não encontrado.' })

    const { name, send_time, timezone, recurrence_type, recurrence_days, items } = req.body

    if (items) {
      if (!Array.isArray(items) || items.length < 2 || items.length > 12) {
        return res.status(400).json({ error: 'Checklist deve ter entre 2 e 12 itens.' })
      }
      const texts = items.map((i: any) => i.text?.trim()).filter(Boolean)
      if (texts.length < 2 || texts.length > 12) {
        return res.status(400).json({ error: 'Checklist deve ter entre 2 e 12 itens com texto.' })
      }
      if (new Set(texts.map((t: string) => t.toLowerCase())).size !== texts.length) {
        return res.status(400).json({ error: 'Itens duplicados não são permitidos.' })
      }
    }

    const updates: string[] = []
    const values: any[] = []
    if (name !== undefined) { updates.push('name = ?'); values.push(name) }
    if (send_time !== undefined) { updates.push('send_time = ?'); values.push(send_time) }
    if (timezone !== undefined) { updates.push('timezone = ?'); values.push(timezone) }
    if (recurrence_type !== undefined) { updates.push('recurrence_type = ?'); values.push(recurrence_type) }
    if (recurrence_days !== undefined) { updates.push('recurrence_days = ?'); values.push(JSON.stringify(recurrence_days)) }

    const hasChanges = updates.length > 0 || !!items
    if (hasChanges) {
      updates.push('updated_at = NOW()')
      values.push(req.params.id)
      await pool.query(`UPDATE checklists SET ${updates.join(', ')} WHERE id = ?`, values)
    }

    if (items) {
      await pool.query('DELETE FROM checklist_items WHERE checklist_id = ?', [req.params.id])
      const texts = items.map((i: any) => i.text?.trim()).filter(Boolean)
      const itemValues = texts.map((text: string, i: number) => [uuidv4(), req.params.id, text, i])
      await pool.query('INSERT INTO checklist_items (id, checklist_id, text, sort_order) VALUES ?', [itemValues])
    }

    const checklist = await getChecklistById(req.params.id, req.userId!)
    checklist.items = await getItems(req.params.id)
    res.json(checklist)
  } catch (err: any) {
    console.error('[checklists] PUT /:id', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// -------- DELETE /api/checklists/:id --------
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const [ownership]: any = await pool.query(
      'SELECT id FROM checklists WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId!],
    )
    if (!ownership.length) return res.status(404).json({ error: 'Checklist não encontrado.' })

    await pool.query('DELETE FROM checklists WHERE id = ?', [req.params.id])
    res.status(204).send()
  } catch (err: any) {
    console.error('[checklists] DELETE /:id', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// -------- DELETE /api/checklists/:id/history - limpa o histórico de polls --------
// Apaga todos os checklist_daily_polls do checklist (incluindo o de hoje),
// mantendo o checklist e seus itens intactos.
router.delete('/:id/history', async (req: Request, res: Response) => {
  try {
    const [ownership]: any = await pool.query(
      'SELECT id FROM checklists WHERE id = ? AND user_id = ?',
      [req.params.id, req.userId!],
    )
    if (!ownership.length) return res.status(404).json({ error: 'Checklist não encontrado.' })

    const [result]: any = await pool.query(
      'DELETE FROM checklist_daily_polls WHERE checklist_id = ?',
      [req.params.id],
    )
    res.json({ deleted: result.affectedRows ?? 0 })
  } catch (err: any) {
    console.error('[checklists] DELETE /:id/history', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// GET /api/checklists/polls
// Query params:
//   upcoming=true  — poll de hoje com status=pending (inclui itens)
//   history=true   — últimos 30 polls enviados/concluídos (inclui itens e selected_options)
// Sempre retorna array. upcoming=true retorna [] ou [poll].
router.get('/polls', async (req: Request, res: Response) => {
  try {
    const { upcoming, history } = req.query

    let condition: string
    if (upcoming === 'true') {
      condition = "cdp.poll_date = CURDATE() AND cdp.status = 'pending'"
    } else if (history === 'true') {
      condition = "cdp.status IN ('sent','completed')"
    } else {
      return res.status(400).json({ error: 'Parâmetro upcoming ou history obrigatório' })
    }

    const [rows]: any = await pool.query(
      `SELECT cdp.id, cdp.checklist_id, cdp.poll_date, cdp.status,
              cdp.completed_count, cdp.total_count, cdp.completion_pct,
              cdp.selected_options, cdp.updated_at AS sent_at,
              c.name AS checklist_name,
              GROUP_CONCAT(ci.text ORDER BY ci.sort_order SEPARATOR '|||') AS items_concat
       FROM checklist_daily_polls cdp
       JOIN checklists c ON c.id = cdp.checklist_id
       JOIN checklist_items ci ON ci.checklist_id = cdp.checklist_id
       WHERE cdp.user_id = ? AND ${condition}
       GROUP BY cdp.id
       ORDER BY cdp.poll_date DESC
       LIMIT 30`,
      [req.userId]
    )

    const polls = rows.map((row: any) => {
      const rawOptions = row.selected_options
      return {
        id: row.id,
        checklist_id: row.checklist_id,
        checklist_name: row.checklist_name,
        poll_date: row.poll_date instanceof Date
          ? row.poll_date.toISOString().slice(0, 10)
          : String(row.poll_date).slice(0, 10),
        status: row.status,
        completed_count: row.completed_count,
        total_count: row.total_count,
        completion_pct: Number(row.completion_pct),
        selected_options: Array.isArray(rawOptions)
          ? rawOptions
          : (rawOptions ? JSON.parse(rawOptions) : []),
        items: row.items_concat ? row.items_concat.split('|||') : [],
        sent_at: row.sent_at,
      }
    })

    res.json(polls)
  } catch (err: any) {
    console.error('[checklists] GET /polls', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// -------- GET /api/checklists/stats - contadores de conclusão por checklist --------
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const [rows]: any = await pool.query(
      `SELECT c.id AS checklist_id,
              SUM(CASE WHEN cdp.completion_pct = 100 AND cdp.poll_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY) THEN 1 ELSE 0 END) AS week_count,
              SUM(CASE WHEN cdp.completion_pct = 100 AND cdp.poll_date >= DATE_SUB(CURDATE(), INTERVAL 29 DAY) THEN 1 ELSE 0 END) AS month_count,
              SUM(CASE WHEN cdp.completion_pct = 100 THEN 1 ELSE 0 END) AS total_count
       FROM checklists c
       LEFT JOIN checklist_daily_polls cdp
         ON cdp.checklist_id = c.id AND cdp.status IN ('sent', 'completed')
       WHERE c.user_id = ?
       GROUP BY c.id`,
      [req.userId!],
    )

    const stats = rows.map((r: any) => ({
      checklist_id: r.checklist_id,
      week_count: Number(r.week_count) || 0,
      month_count: Number(r.month_count) || 0,
      total_count: Number(r.total_count) || 0,
    }))

    res.json(stats)
  } catch (err: any) {
    console.error('[checklists] GET /stats', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// -------- GET /api/checklists/dashboard - dados do dashboard do checklist --------
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const { checklistId } = req.query

    let checklist
    if (checklistId) {
      checklist = await getChecklistById(String(checklistId), req.userId!)
      if (!checklist) return res.status(404).json({ error: 'Checklist não encontrado.' })
    } else {
      checklist = await getMostRecentChecklist(req.userId!)
    }
    if (!checklist) return res.json({ checklist: null, today: null, history: [], itemStats: [] })

    const today = getTodaySaoPaulo()

    const [todayRows]: any = await pool.query(
      `SELECT id, poll_date, waha_poll_id, selected_options,
              completed_count, total_count, completion_pct, status, created_at
       FROM checklist_daily_polls
       WHERE checklist_id = ? AND poll_date = ?`,
      [checklist.id, today],
    )

    const rawOpts = todayRows[0]?.selected_options
    const selectedOptions = Array.isArray(rawOpts) ? rawOpts : (rawOpts ? JSON.parse(rawOpts) : [])

    const todayPoll = todayRows.length > 0 ? {
      ...todayRows[0],
      selected_options: selectedOptions,
    } : null

    const [historyRows]: any = await pool.query(
      `SELECT poll_date, completed_count, total_count, completion_pct, status
       FROM checklist_daily_polls
       WHERE checklist_id = ?
       ORDER BY poll_date DESC
       LIMIT 84`,
      [checklist.id],
    )

    const history = historyRows.map((r: any) => ({
      ...r,
      selected_options: undefined,
    }))

    const items = await getItems(checklist.id)

    const [itemPollRows]: any = await pool.query(
      `SELECT selected_options
       FROM checklist_daily_polls
       WHERE checklist_id = ? AND status IN ('sent', 'completed')
         AND poll_date >= DATE_SUB(CURDATE(), INTERVAL 29 DAY)`,
      [checklist.id],
    )
    const pollsSelectedOptions: string[][] = itemPollRows.map((r: any) => {
      const raw = r.selected_options
      return Array.isArray(raw) ? raw : (raw ? JSON.parse(raw) : [])
    })
    const itemStats = computeItemStats(items.map((i: any) => i.text), pollsSelectedOptions)

    res.json({ checklist: { ...checklist, items }, today: todayPoll, history, itemStats })
  } catch (err: any) {
    console.error('[checklists] GET /dashboard', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// -------- POST /api/checklists/send-now - envio manual/teste --------
router.post('/send-now', async (req: Request, res: Response) => {
  try {
    const { force, checklistId: requestedId } = req.body

    let checklist
    if (requestedId) {
      // Verificar ownership do checklist específico
      const [rows]: any = await pool.query(
        'SELECT id, user_id FROM checklists WHERE id = ? AND user_id = ?',
        [requestedId, req.userId!]
      )
      if (!rows.length) return res.status(404).json({ error: 'Checklist não encontrado.' })
      checklist = rows[0]
    } else {
      checklist = await getMostRecentChecklist(req.userId!)
      if (!checklist) return res.status(404).json({ error: 'Nenhum checklist cadastrado.' })
    }

    try {
      await sendDailyPoll(checklist.id, req.userId!, { force })
    } catch (err: any) {
      console.error('[checklists] POST /send-now erro no dispatch:', err.message)
      return res.status(502).json({ error: `Erro ao enviar pelo WAHA: ${err.message}` })
    }

    res.json({ ok: true })
  } catch (err: any) {
    console.error('[checklists] POST /send-now', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router
