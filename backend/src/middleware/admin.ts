import { Request, Response, NextFunction } from 'express'
import { usuarioEhAdmin } from '../services/adminAccess'

/** Só o administrador passa. Deve vir depois do authMiddleware. */
export async function adminMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.userId && req.userId !== '__service__' && (await usuarioEhAdmin(req.userId))) {
      return next()
    }
    return res.status(403).json({ error: 'Acesso restrito ao administrador' })
  } catch (err) {
    console.error('[admin] erro ao checar acesso:', err)
    return res.status(500).json({ error: 'Erro interno do servidor' })
  }
}
