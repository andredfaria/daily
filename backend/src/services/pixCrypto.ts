// backend/src/services/pixCrypto.ts
// S10 — Criptografia de pix_key em repouso (AES-256-GCM).
//
// Formato do valor cifrado: "enc:v1:<iv_b64>:<tag_b64>:<ciphertext_b64>".
// O prefixo permite detectar valores legados em plaintext e migrá-los sem
// quebrar leituras. A chave vem da env PIX_ENCRYPTION_KEY (qualquer string;
// derivada para 32 bytes via scrypt, então aceita tanto chave crua quanto
// passphrase). Em produção a chave é obrigatória; em dev, sem chave, o valor
// é mantido em plaintext com aviso — mesmo padrão do HMAC do webhook.

import crypto from 'crypto'
import pool from '../db'

const PREFIX = 'enc:v1:'
const ALGO = 'aes-256-gcm'
const IS_PROD = process.env.NODE_ENV === 'production'
const SCRYPT_SALT = 'billsync-pix-v1'

let cachedKey: Buffer | null | undefined

function getKey(): Buffer | null {
  if (cachedKey !== undefined) return cachedKey
  const raw = process.env.PIX_ENCRYPTION_KEY
  if (!raw) {
    if (IS_PROD) {
      throw new Error('PIX_ENCRYPTION_KEY é obrigatória em produção para cifrar dados de pagamento')
    }
    console.warn('[pixCrypto] PIX_ENCRYPTION_KEY não configurada — pix_key será armazenada em plaintext (dev)')
    cachedKey = null
    return null
  }
  cachedKey = crypto.scryptSync(raw, SCRYPT_SALT, 32)
  return cachedKey
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX)
}

/** Cifra um valor para armazenamento. Sem chave (dev), retorna o plaintext. */
export function encryptPix(plain: string | null | undefined): string | null {
  if (plain === null || plain === undefined || plain === '') return plain ?? null
  if (isEncrypted(plain)) return plain // já cifrado, idempotente
  const key = getKey()
  if (!key) return plain
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`
}

/** Decifra um valor lido do banco. Valores legados em plaintext passam intactos. */
export function decryptPix(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  if (!isEncrypted(value)) return value // legado em plaintext
  const key = getKey()
  if (!key) {
    console.warn('[pixCrypto] valor cifrado sem PIX_ENCRYPTION_KEY — impossível decifrar')
    return value
  }
  try {
    const [, , ivB64, tagB64, ctB64] = value.split(':')
    const iv = Buffer.from(ivB64, 'base64')
    const tag = Buffer.from(tagB64, 'base64')
    const ct = Buffer.from(ctB64, 'base64')
    const decipher = crypto.createDecipheriv(ALGO, key, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
  } catch (err: any) {
    console.error('[pixCrypto] falha ao decifrar pix_key:', err.message)
    return null
  }
}

/**
 * Cifra pix_keys que ainda estão em plaintext no banco (S10).
 * Idempotente e auto-curável: roda no boot, só toca linhas não cifradas.
 * Sem chave configurada, não faz nada (mantém o comportamento de dev).
 */
export async function backfillPixEncryption(): Promise<void> {
  let key: Buffer | null
  try {
    key = getKey()
  } catch {
    // Em produção sem chave, getKey lança — deixa o erro fluir no boot.
    throw new Error('PIX_ENCRYPTION_KEY é obrigatória em produção para cifrar dados de pagamento')
  }
  if (!key) return

  const [rows]: any = await pool.query(
    `SELECT id, pix_key FROM payment_methods
     WHERE pix_key IS NOT NULL AND pix_key <> '' AND pix_key NOT LIKE 'enc:v1:%'`
  )
  if (!rows.length) return

  for (const r of rows) {
    const enc = encryptPix(r.pix_key)
    await pool.query('UPDATE payment_methods SET pix_key = ? WHERE id = ?', [enc, r.id])
  }
  console.log(`[pixCrypto] ${rows.length} pix_key(s) legada(s) cifrada(s) em repouso`)
}
