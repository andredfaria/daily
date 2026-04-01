import express from 'express'
import * as dotenv from 'dotenv'
import path from 'path'

// Carrega o .env — tenta raiz do projeto (dev local) e raiz do container
dotenv.config({ path: path.join(__dirname, '../../.env') })
dotenv.config({ path: '/.env' })

import billsRouter from './routes/bills'
import occurrencesRouter from './routes/occurrences'
import notificationsRouter from './routes/notifications'
import wahaRouter from './routes/waha'
import usersRouter from './routes/users'

const app = express()
const PORT = Number(process.env.PORT) || 4000

app.use(express.json())

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '0.1.0', timestamp: new Date().toISOString() })
})

// Rotas
app.use('/api/bills', billsRouter)
app.use('/api/occurrences', occurrencesRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/waha', wahaRouter)
app.use('/api/users', usersRouter)

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[backend] running on port ${PORT}`)
  console.log(`[backend] using database: ${process.env.DB_NAME} at ${process.env.DB_HOST}`)
})
