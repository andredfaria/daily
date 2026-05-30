import { Router, Request, Response } from 'express'
import pool from '../db'
import { runDispatchForUser, sendSingleNotification } from '../dispatcher'
import { materializeForUser, getTodaySaoPaulo } from '../services/notificationMaterializer'
import { decryptPix } from '../services/pixCrypto'

const router = Router()

// GET /api/notifications/due-today
router.get('/due-today', async (req: Request, res: Response) => {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const [rows] = await pool.query(
      `SELECT n.*, b.name AS bill_name, o.due_date, o.amount
       FROM notifications n
       JOIN bill_occurrences o ON o.id = n.bill_occurrence_id
       JOIN bills b ON b.id = o.bill_id
       WHERE o.due_date BETWEEN ? AND ? AND n.status = 'scheduled' AND b.user_id = ?
       ORDER BY n.scheduled_for ASC`,
      [today, tomorrow, req.userId]
    )
    res.json(rows)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// GET /api/notifications
// Query params:
//   status=<single>    — filtra por status exato
//   upcoming=true      — status=scheduled E scheduled_for >= hoje
//   history=true       — status IN (sent, failed, skipped)
//   limit=<n>          — padrão 50 (200 quando history=true)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, upcoming, history, limit } = req.query
    const conditions: string[] = []
    const values: any[] = []

    conditions.push('b.user_id = ?')
    values.push(req.userId)

    if (upcoming === 'true') {
      conditions.push("n.status = 'scheduled' AND n.scheduled_for >= CURDATE()")
    } else if (history === 'true') {
      conditions.push("n.status IN ('sent','failed','skipped')")
    } else if (status) {
      conditions.push('n.status = ?')
      values.push(status)
    }

    const defaultLimit = history === 'true' ? 200 : 50
    const effectiveLimit = Number(limit ?? defaultLimit)

    const where = `WHERE ${conditions.join(' AND ')}`
    values.push(effectiveLimit)

    const [rows]: any = await pool.query(
      `SELECT n.*, b.name AS bill_name, o.due_date, o.amount,
              pm.type AS pm_type, pm.pix_key_type, pm.pix_key,
              pm.pix_beneficiary, pm.boleto_code
       FROM notifications n
       JOIN bill_occurrences o ON o.id = n.bill_occurrence_id
       JOIN bills b ON b.id = o.bill_id
       LEFT JOIN payment_methods pm ON pm.bill_id = b.id AND pm.is_primary = 1
       ${where} ORDER BY n.scheduled_for DESC LIMIT ?`,
      values
    )
    res.json(rows.map((r: any) => ({ ...r, pix_key: decryptPix(r.pix_key) })))
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// PATCH /api/notifications/:id/sent
router.patch('/:id/sent', async (req: Request, res: Response) => {
  try {
    if (req.userId !== '__service__') {
      const [ownerRows]: any = await pool.query(
        'SELECT n.id FROM notifications n JOIN bill_occurrences o ON o.id = n.bill_occurrence_id JOIN bills b ON b.id = o.bill_id WHERE n.id = ? AND b.user_id = ?',
        [req.params.id, req.userId]
      )
      if (!ownerRows.length) return res.status(404).json({ error: 'Not found' })
    }

    const { waha_message_id } = req.body
    const now = new Date()
    await pool.query(
      `UPDATE notifications SET status = 'sent', sent_at = ?, waha_message_id = ? WHERE id = ?`,
      [now, waha_message_id ?? null, req.params.id]
    )
    const [rows]: any = await pool.query(
      `SELECT n.*, b.name AS bill_name, o.due_date, o.amount
       FROM notifications n
       JOIN bill_occurrences o ON o.id = n.bill_occurrence_id
       JOIN bills b ON b.id = o.bill_id
       WHERE n.id = ?`,
      [req.params.id]
    )
    res.json(rows[0])
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// PATCH /api/notifications/:id/failed
router.patch('/:id/failed', async (req: Request, res: Response) => {
  try {
    if (req.userId !== '__service__') {
      const [ownerRows]: any = await pool.query(
        'SELECT n.id FROM notifications n JOIN bill_occurrences o ON o.id = n.bill_occurrence_id JOIN bills b ON b.id = o.bill_id WHERE n.id = ? AND b.user_id = ?',
        [req.params.id, req.userId]
      )
      if (!ownerRows.length) return res.status(404).json({ error: 'Not found' })
    }

    const { error_detail } = req.body
    await pool.query(
      `UPDATE notifications SET status = 'failed', error_detail = ? WHERE id = ?`,
      [error_detail ?? null, req.params.id]
    )
    const [rows]: any = await pool.query(
      `SELECT n.*, b.name AS bill_name, o.due_date, o.amount
       FROM notifications n
       JOIN bill_occurrences o ON o.id = n.bill_occurrence_id
       JOIN bills b ON b.id = o.bill_id
       WHERE n.id = ?`,
      [req.params.id]
    )
    res.json(rows[0])
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// POST /api/notifications/:id/resend
// Reenvia uma notificação individual (scheduled ou failed).
router.post('/:id/resend', async (req: Request, res: Response) => {
  try {
    // Verificar ownership
    const [ownerRows]: any = await pool.query(
      `SELECT n.id, n.status FROM notifications n
       JOIN bill_occurrences o ON o.id = n.bill_occurrence_id
       JOIN bills b ON b.id = o.bill_id
       WHERE n.id = ? AND b.user_id = ?`,
      [req.params.id, req.userId]
    )
    if (!ownerRows.length) return res.status(404).json({ error: 'Notificação não encontrada' })

    // Se estava failed, resetar para scheduled para que sendSingleNotification possa processar
    if (ownerRows[0].status === 'failed') {
      await pool.query(
        `UPDATE notifications SET status='scheduled', error_detail=NULL WHERE id=?`,
        [req.params.id]
      )
    }

    const result = await sendSingleNotification(req.params.id)

    const [rows]: any = await pool.query(
      `SELECT n.*, b.name AS bill_name, o.due_date, o.amount
       FROM notifications n
       JOIN bill_occurrences o ON o.id = n.bill_occurrence_id
       JOIN bills b ON b.id = o.bill_id
       WHERE n.id = ?`,
      [req.params.id]
    )
    res.json({ result, notification: rows[0] })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/notifications/dispatch
// Dispara o envio das notificações do dia imediatamente (manual/debug).
router.post('/dispatch', async (req: Request, res: Response) => {
  try {
    const result = await runDispatchForUser(req.userId!)
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/notifications/:id
// Cancela (hard delete) uma notificação com status=scheduled.
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const [ownerRows]: any = await pool.query(
      `SELECT n.id, n.status FROM notifications n
       JOIN bill_occurrences o ON o.id = n.bill_occurrence_id
       JOIN bills b ON b.id = o.bill_id
       WHERE n.id = ? AND b.user_id = ?`,
      [req.params.id, req.userId]
    )
    if (!ownerRows.length) {
      return res.status(404).json({ error: 'Notificação não encontrada' })
    }
    if (ownerRows[0].status !== 'scheduled') {
      return res.status(400).json({ error: 'Apenas notificações agendadas podem ser canceladas' })
    }
    await pool.query('DELETE FROM notifications WHERE id = ?', [req.params.id])
    res.status(204).send()
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

// POST /api/notifications/materialize
// Gera notificações para os próximos N dias (padrão 30) sem disparar envio.
router.post('/materialize', async (req: Request, res: Response) => {
  try {
    const days = Math.min(Number(req.query.days ?? 30), 90)
    const today = getTodaySaoPaulo()
    let created = 0
    for (let i = 0; i < days; i++) {
      const d = new Date(today + 'T00:00:00')
      d.setDate(d.getDate() + i)
      const dateStr = d.toISOString().slice(0, 10)
      created += await materializeForUser(req.userId!, dateStr)
    }
    res.json({ created, days })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
})

export default router
