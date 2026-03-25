import express from 'express'

const app = express()
const PORT = Number(process.env.PORT) || 4000

app.use(express.json())

// Health check — usado pelo Easypanel e pelo HEALTHCHECK do Docker
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[backend] running on port ${PORT}`)
})
