import express, { Request, Response, NextFunction } from 'express'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(__dirname, '../../.env') })
dotenv.config({ path: '/.env' })

import pool from './db'
import billsRouter from './routes/bills'
import occurrencesRouter from './routes/occurrences'
import notificationsRouter from './routes/notifications'
import wahaRouter from './routes/waha'
import usersRouter from './routes/users'
import authRouter from './routes/auth'
import { authMiddleware } from './middleware/auth'
import { initScheduler } from './scheduler'

const app = express()
const PORT = Number(process.env.PORT) || 4000

app.use(express.json())

app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[req] ${req.method} ${req.path}`)
  next()
})

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1')
    res.json({ status: 'ok', db: 'connected', version: '0.1.0', timestamp: new Date().toISOString() })
  } catch (err: any) {
    console.error('[health] falha na conexão com banco:', err.message)
    res.status(503).json({ status: 'degraded', db: 'error', error: err.message })
  }
})

app.use('/api/auth', authRouter)
app.use(authMiddleware)
app.use('/api/bills', billsRouter)
app.use('/api/occurrences', occurrencesRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/waha', wahaRouter)
app.use('/api/users', usersRouter)

app.use((req: Request, res: Response) => {
  console.warn(`[404] rota não encontrada: ${req.method} ${req.path}`)
  res.status(404).json({ error: `rota não encontrada: ${req.method} ${req.path}` })
})

app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  console.error(`[500] erro em ${req.method} ${req.path}:`, err)
  res.status(500).json({ error: err.message || 'erro interno' })
})

process.on('uncaughtException', (err) => {
  console.error('[fatal] uncaughtException:', err)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  console.error('[fatal] unhandledRejection:', reason)
  process.exit(1)
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[backend] running on port ${PORT}`)
  console.log(`[backend] DB_HOST=${process.env.DB_HOST || 'não definido'}`)
  console.log(`[backend] DB_NAME=${process.env.DB_NAME || 'não definido'}`)
  console.log(`[backend] DB_USER=${process.env.DB_USER || 'não definido'}`)
  console.log(`[backend] DB_PASSWORD=${process.env.DB_PASSWORD ? '***definido***' : 'não definido'}`)
  initScheduler()
})
