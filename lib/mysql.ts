import mysql from 'mysql2/promise'

// Pool de conexões MySQL reutilizável
let pool: mysql.Pool | null = null

export function getPool(): mysql.Pool {
  if (!pool) {
    const url = process.env.MYSQL_URL
    if (!url) {
      throw new Error('MYSQL_URL não configurado nas variáveis de ambiente')
    }

    pool = mysql.createPool({
      uri: url,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      timezone: '-03:00',
    })
  }
  return pool
}

/**
 * Executa uma query e retorna as linhas resultantes.
 * Uso: const rows = await query('SELECT * FROM daily_user WHERE id = ?', [id])
 */
export async function query<T>(sql: string, values?: unknown[]): Promise<T[]> {
  const pool = getPool()
  const [rows] = await pool.execute(sql, values)
  return rows as T[]
}

/**
 * Executa uma query de mutação (INSERT, UPDATE, DELETE).
 * Retorna o ResultSetHeader com insertId, affectedRows, etc.
 */
export async function execute(sql: string, values?: unknown[]): Promise<mysql.ResultSetHeader> {
  const pool = getPool()
  const [result] = await pool.execute(sql, values)
  return result as mysql.ResultSetHeader
}
