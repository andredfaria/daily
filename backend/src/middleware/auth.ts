import { Request, Response, NextFunction } from 'express'
import { validarSessao } from '../services/sessions'

declare global {
  namespace Express {
    interface Request {
      userId?: string
      sessionId?: string
    }
  }
}

const SERVICE_ALLOWED_PATHS = [
  '/api/notifications',
  '/api/webhooks',
]

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Allow n8n service-to-service calls via API key — escopo restrito
  const apiKey = req.headers['x-api-key']
  if (process.env.N8N_API_KEY && apiKey === process.env.N8N_API_KEY) {
    const allowed = SERVICE_ALLOWED_PATHS.some(prefix => req.originalUrl.startsWith(prefix))
    if (!allowed) {
      return res.status(403).json({ error: 'Service account não tem acesso a este recurso' })
    }
    req.userId = '__service__'
    return next()
  }

  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' })
  }

  // JWT antigo não passa daqui: só é aceito em POST /api/auth/upgrade-session,
  // que o troca por uma sessão.
  let sessao: { sessionId: string; userId: string } | null
  try {
    sessao = await validarSessao(header.slice(7), req.headers['user-agent'])
  } catch (err) {
    console.error('[auth] erro ao validar sessão:', err)
    return res.status(500).json({ error: 'Erro interno do servidor' })
  }
  if (!sessao) {
    return res.status(401).json({ error: 'Token inválido ou expirado' })
  }
  req.userId = sessao.userId
  req.sessionId = sessao.sessionId
  next()
}
