import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

declare global {
  namespace Express {
    interface Request {
      userId?: string
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Allow n8n service-to-service calls via API key
  const apiKey = req.headers['x-api-key']
  if (process.env.N8N_API_KEY && apiKey === process.env.N8N_API_KEY) {
    req.userId = '__service__'
    return next()
  }

  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' })
  }

  try {
    const token = header.slice(7)
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string }
    req.userId = payload.userId
    next()
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' })
  }
}
