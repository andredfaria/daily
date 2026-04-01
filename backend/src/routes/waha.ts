import { Router, Request, Response } from 'express'
import axios from 'axios'

const router = Router()

function wahaClient() {
  return axios.create({
    baseURL: process.env.WAHA_URL || 'http://localhost:3000',
    headers: {
      'X-Api-Key': process.env.WAHA_API_KEY || '',
      'Content-Type': 'application/json',
    },
    timeout: 8000,
  })
}

// GET /api/waha/status
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const session = process.env.WAHA_SESSION || 'default'
    const { data } = await wahaClient().get(`/api/sessions/${session}`)
    res.json({
      connected: data.status === 'WORKING',
      session: data.name,
      status: data.status,
    })
  } catch (err: any) {
    res.json({ connected: false, error: err.message })
  }
})

// POST /api/waha/reconnect
router.post('/reconnect', async (_req: Request, res: Response) => {
  try {
    const session = process.env.WAHA_SESSION || 'default'
    const { data } = await wahaClient().post(`/api/sessions/${session}/restart`)
    res.json({ status: data.status ?? 'restarting', qr_code: data.qr ?? undefined })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/waha/disconnect
router.post('/disconnect', async (_req: Request, res: Response) => {
  try {
    const session = process.env.WAHA_SESSION || 'default'
    await wahaClient().post(`/api/sessions/${session}/stop`)
    res.json({ status: 'stopped' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
