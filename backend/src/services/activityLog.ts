import pool from '../db'

export type KindAtividade =
  | 'login'
  | 'login_falha'
  | 'otp_pedido'
  | 'logout'
  | 'acesso'
  | 'msg_enviada'
  | 'comando'
  | 'erro_api'
  | 'erro_tick'

export type StatusAtividade = 'ok' | 'falha' | 'ignorado'

export interface EventoAtividade {
  userId?: string | null
  kind: KindAtividade
  status?: StatusAtividade
  ref?: string | null
  detail?: string | null
  error?: string | null
  meta?: Record<string, unknown> | null
}

/** Contexto de um envio de WhatsApp: quem recebe e que tipo de mensagem é. */
export interface ContextoEnvio {
  userId?: string | null
  tipo: string
}

export function cortarTexto(s: string | null | undefined, max = 2000): string | null {
  if (s === null || s === undefined || s === '') return null
  return s.length > max ? s.slice(0, max) : s
}

/** Troca sequências de 4 a 8 dígitos (códigos OTP) por asteriscos. */
export function mascararOtp(texto: string): string {
  return texto.replace(/\d{4,8}/g, '******')
}

// Não importa ./waha (waha importa este módulo): detecta pelo name.
export function descreverErroEnvio(err: any): string {
  if (err?.name === 'WhatsAppNumberNotFoundError') return 'número não encontrado no WhatsApp'
  if (err?.response) {
    const data = err.response.data
    const msg = data?.message || data?.error || err.response.statusText || ''
    return `HTTP ${err.response.status}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`
  }
  return [err?.code, err?.message].filter(Boolean).join(' ') || 'erro desconhecido'
}

export function nomeDoComando(texto: string): string | null {
  const t = (texto || '').trim()
  if (!t.startsWith('/')) return null
  return t.split(/\s+/)[0].toLowerCase()
}

export function normalizarUserId(id: string | null | undefined): string | null {
  if (!id || id === '__service__') return null
  return id
}

/** Monta o evento de um envio. O texto do OTP nunca vai inteiro para o log. */
export function eventoDeEnvio(
  ctx: ContextoEnvio | undefined,
  texto: string,
  resultado: { id: string | null } | { erro: any },
  extra?: Record<string, unknown>,
): EventoAtividade {
  const tipo = ctx?.tipo ?? 'desconhecido'
  const base = {
    userId: ctx?.userId ?? null,
    kind: 'msg_enviada' as const,
    ref: tipo,
    detail: tipo === 'otp' ? mascararOtp(texto) : texto,
  }
  if ('erro' in resultado) {
    return {
      ...base,
      status: 'falha',
      error: descreverErroEnvio(resultado.erro),
      meta: extra ?? null,
    }
  }
  return {
    ...base,
    status: 'ok',
    meta: { ...(resultado.id ? { waha_message_id: resultado.id } : {}), ...(extra ?? {}) },
  }
}

/** Evento único de um comando tratado: ok, ou falha quando a resposta não saiu. */
export function eventoDeComando(
  userId: string,
  nome: string | null,
  resultado?: { erro: any },
): EventoAtividade {
  return resultado
    ? { userId, kind: 'comando', status: 'falha', ref: nome, error: descreverErroEnvio(resultado.erro) }
    : { userId, kind: 'comando', status: 'ok', ref: nome }
}

/** Grava o evento. Nunca lança nem rejeita: log não derruba o fluxo. */
export async function registrarAtividade(ev: EventoAtividade): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO activity_log (user_id, kind, status, ref, detail, error, meta)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        normalizarUserId(ev.userId),
        ev.kind,
        ev.status ?? 'ok',
        cortarTexto(ev.ref, 60),
        cortarTexto(ev.detail),
        cortarTexto(ev.error),
        ev.meta ? JSON.stringify(ev.meta) : null,
      ]
    )
  } catch (err: any) {
    console.error('[activity] falha ao gravar atividade:', err?.message)
  }
}

/** Apaga eventos com mais de 90 dias, em lotes. Devolve o total apagado. */
export async function limparAtividadeAntiga(): Promise<number> {
  let total = 0
  for (;;) {
    const [res]: any = await pool.query(
      `DELETE FROM activity_log WHERE created_at < NOW() - INTERVAL 90 DAY LIMIT 5000`
    )
    const n = res?.affectedRows ?? 0
    total += n
    if (n < 5000) break
  }
  return total
}
