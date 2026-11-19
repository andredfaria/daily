import { Request, Response, NextFunction } from 'express'
import { registrarAtividade, rotaNormalizada } from '../services/activityLog'

/** Registra em activity_log toda resposta 5xx da API, com a rota sem ids e a mensagem de erro. */
export function activityErrorsMiddleware(req: Request, res: Response, next: NextFunction) {
  const inicio = Date.now()
  const jsonOriginal = res.json.bind(res)
  res.json = ((body: any) => {
    if (body && typeof body.error === 'string') res.locals.erroResposta = body.error
    return jsonOriginal(body)
  }) as typeof res.json

  res.on('finish', () => {
    if (res.statusCode < 500) return
    const rota = rotaNormalizada(req.baseUrl, req.route?.path, req.path)
    void registrarAtividade({
      userId: req.userId,
      kind: 'erro_api',
      status: 'falha',
      ref: `${req.method} ${rota}`,
      error: res.locals.erroResposta ?? `HTTP ${res.statusCode}`,
      meta: { duracao_ms: Date.now() - inicio },
    })
  })
  next()
}
