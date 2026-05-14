import { Router, Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import pool from '../db'

const router = Router()

// -------- Helpers --------

async function getChecklist(userId: string) {
  const [rows]: any = await pool.query(
    'SELECT id, user_id, name, send_time, timezone, is_active, created_at, updated_at FROM checklists WHERE user_id = ?',
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

// -------- GET /api/checklists - retorna o checklist do usuário (1 por usuário no MVP) --------
router.get('/', async (req: Request, res: Response) => {
  try {
    const checklist = await getChecklist(req.userId!)
    if (!checklist) return res.json(null)

    checklist.items = await getItems(checklist.id)
    res.json(checklist)
  } catch (err: any) {
    console.error('[checklists] GET /', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// -------- POST /api/checklists - cria checklist com itens --------
router.post('/', async (req: Request, res: Response) => {
  try {
    const existing = await getChecklist(req.userId!)
    if (existing) {
      return res.status(409).json({ error: 'Usuário já possui um checklist. Edite o existente.' })
    }

    const { name, send_time, timezone, items } = req.body

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

    const checklistId = uuidv4()
    await pool.query(
      'INSERT INTO checklists (id, user_id, name, send_time, timezone) VALUES (?, ?, ?, ?, ?)',
      [checklistId, req.userId!, name || 'Checklist Diário', send_time ?? 9, timezone || 'America/Sao_Paulo'],
    )

    const itemValues = texts.map((text: string, i: number) => [uuidv4(), checklistId, text, i])
    await pool.query(
      'INSERT INTO checklist_items (id, checklist_id, text, sort_order) VALUES ?',
      [itemValues],
    )

    const checklist = await getChecklist(req.userId!)
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

    const { name, send_time, timezone, items } = req.body

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

    if (updates.length > 0) {
      values.push(req.params.id)
      await pool.query(`UPDATE checklists SET ${updates.join(', ')} WHERE id = ?`, values)
    }

    if (items) {
      await pool.query('DELETE FROM checklist_items WHERE checklist_id = ?', [req.params.id])
      const texts = items.map((i: any) => i.text?.trim()).filter(Boolean)
      const itemValues = texts.map((text: string, i: number) => [uuidv4(), req.params.id, text, i])
      await pool.query('INSERT INTO checklist_items (id, checklist_id, text, sort_order) VALUES ?', [itemValues])
    }

    const checklist = await getChecklist(req.userId!)
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

// -------- GET /api/checklists/dashboard - dados do dashboard do checklist --------
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const checklist = await getChecklist(req.userId!)
    if (!checklist) return res.json({ checklist: null, today: null, history: [] })

    const today = new Date().toISOString().slice(0, 10)

    const [todayRows]: any = await pool.query(
      `SELECT id, poll_date, waha_poll_id, selected_options,
              completed_count, total_count, completion_pct, status, created_at
       FROM checklist_daily_polls
       WHERE checklist_id = ? AND poll_date = ?`,
      [checklist.id, today],
    )

    const todayPoll = todayRows.length > 0 ? {
      ...todayRows[0],
      selected_options: todayRows[0].selected_options ? JSON.parse(todayRows[0].selected_options) : [],
    } : null

    const [historyRows]: any = await pool.query(
      `SELECT poll_date, completed_count, total_count, completion_pct, status
       FROM checklist_daily_polls
       WHERE checklist_id = ?
       ORDER BY poll_date DESC
       LIMIT 14`,
      [checklist.id],
    )

    const history = historyRows.map((r: any) => ({
      ...r,
      selected_options: undefined,
    }))

    const items = await getItems(checklist.id)

    res.json({ checklist: { ...checklist, items }, today: todayPoll, history })
  } catch (err: any) {
    console.error('[checklists] GET /dashboard', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router
