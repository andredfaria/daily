import { RowDataPacket } from 'mysql2'
import { execute, getPool, query } from '@/lib/mysql'

export type PollStatus = 'draft' | 'scheduled' | 'processing' | 'processed' | 'cancelled'
export type PollScheduleStatus = 'scheduled' | 'processing' | 'processed' | 'retry' | 'failed'
export type PollDispatchStatus = 'pending' | 'sent' | 'failed'

export interface Poll extends RowDataPacket {
  id: number
  workspace_id: number
  question: string
  status: PollStatus
  created_by: number
  created_at: string
  updated_at: string
}

export interface PollOption extends RowDataPacket {
  id: number
  poll_id: number
  label: string
  position: number
}

export interface PollSchedule extends RowDataPacket {
  id: number
  poll_id: number
  scheduled_at: string
  timezone: string
  status: PollScheduleStatus
  last_run_at: string | null
  next_run_at: string | null
  attempt_count: number
}

export interface PollDispatch extends RowDataPacket {
  id: number
  poll_id: number
  recipient_phone: string
  waha_message_id: string | null
  status: PollDispatchStatus
  error: string | null
  sent_at: string | null
}

export interface DuePollSchedule extends RowDataPacket {
  schedule_id: number
  poll_id: number
  workspace_id: number
  question: string
  timezone: string
  attempt_count: number
}

export async function createPollWithSchedule(input: {
  workspaceId: number
  createdBy: number
  question: string
  options: string[]
  scheduledAt: Date
  timezone: string
  recipients: string[]
}) {
  const pool = getPool()
  const conn = await pool.getConnection()

  try {
    await conn.beginTransaction()

    const [pollResult] = await conn.execute(
      `INSERT INTO polls (workspace_id, question, status, created_by)
       VALUES (?, ?, 'scheduled', ?)`,
      [input.workspaceId, input.question, input.createdBy]
    )

    const pollId = (pollResult as { insertId: number }).insertId

    for (let i = 0; i < input.options.length; i += 1) {
      await conn.execute(
        'INSERT INTO poll_options (poll_id, label, position) VALUES (?, ?, ?)',
        [pollId, input.options[i], i]
      )
    }

    await conn.execute(
      `INSERT INTO poll_schedules (poll_id, scheduled_at, timezone, status, next_run_at)
       VALUES (?, ?, ?, 'scheduled', ?)`,
      [pollId, input.scheduledAt, input.timezone, input.scheduledAt]
    )

    for (const recipient of input.recipients) {
      await conn.execute(
        `INSERT INTO poll_dispatches (poll_id, recipient_phone, status)
         VALUES (?, ?, 'pending')`,
        [pollId, recipient]
      )
    }

    await conn.commit()

    const created = await getPollById(pollId)
    return created
  } catch (error) {
    await conn.rollback()
    throw error
  } finally {
    conn.release()
  }
}

export async function getPollById(id: number) {
  const polls = await query<Poll>('SELECT * FROM polls WHERE id = ? LIMIT 1', [id])
  const poll = polls[0]
  if (!poll) return null

  const options = await query<PollOption>(
    'SELECT * FROM poll_options WHERE poll_id = ? ORDER BY position ASC',
    [id]
  )
  const schedule = await query<PollSchedule>(
    'SELECT * FROM poll_schedules WHERE poll_id = ? LIMIT 1',
    [id]
  )
  const dispatches = await query<PollDispatch>(
    'SELECT * FROM poll_dispatches WHERE poll_id = ? ORDER BY id ASC',
    [id]
  )

  return { ...poll, options, schedule: schedule[0] ?? null, dispatches }
}

export async function listPollsByWorkspace(workspaceId: number) {
  return query<Poll>(
    'SELECT * FROM polls WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 100',
    [workspaceId]
  )
}

export async function getDuePollSchedules(limit = 25): Promise<DuePollSchedule[]> {
  return query<DuePollSchedule>(
    `SELECT ps.id AS schedule_id, ps.poll_id, p.workspace_id, p.question, ps.timezone, ps.attempt_count
     FROM poll_schedules ps
     INNER JOIN polls p ON p.id = ps.poll_id
     WHERE (
       (ps.status = 'scheduled' AND ps.scheduled_at <= UTC_TIMESTAMP())
       OR (ps.status = 'retry' AND ps.next_run_at IS NOT NULL AND ps.next_run_at <= UTC_TIMESTAMP())
     )
     ORDER BY ps.scheduled_at ASC
     LIMIT ?`,
    [limit]
  )
}

export async function markScheduleProcessing(scheduleId: number) {
  await execute(
    `UPDATE poll_schedules
     SET status = 'processing', last_run_at = UTC_TIMESTAMP()
     WHERE id = ?`,
    [scheduleId]
  )
}

export async function listPendingDispatches(pollId: number) {
  return query<PollDispatch>(
    `SELECT * FROM poll_dispatches
     WHERE poll_id = ? AND status IN ('pending', 'failed')
     ORDER BY id ASC`,
    [pollId]
  )
}

export async function markDispatchSent(dispatchId: number, wahaMessageId?: string) {
  await execute(
    `UPDATE poll_dispatches
     SET status = 'sent', waha_message_id = ?, error = NULL, sent_at = UTC_TIMESTAMP()
     WHERE id = ?`,
    [wahaMessageId ?? null, dispatchId]
  )
}

export async function markDispatchFailed(dispatchId: number, error: string) {
  await execute(
    `UPDATE poll_dispatches
     SET status = 'failed', error = ?
     WHERE id = ?`,
    [error.slice(0, 1000), dispatchId]
  )
}

export async function finalizeScheduleProcessed(scheduleId: number, pollId: number) {
  await execute(
    `UPDATE poll_schedules
     SET status = 'processed', next_run_at = NULL
     WHERE id = ?`,
    [scheduleId]
  )
  await execute(`UPDATE polls SET status = 'processed' WHERE id = ?`, [pollId])
}

export async function scheduleRetry(scheduleId: number, pollId: number, attemptCount: number) {
  const retryInMinutes = Math.min(2 ** attemptCount, 60)
  await execute(
    `UPDATE poll_schedules
     SET status = 'retry',
         attempt_count = attempt_count + 1,
         next_run_at = DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE)
     WHERE id = ?`,
    [retryInMinutes, scheduleId]
  )
  await execute(`UPDATE polls SET status = 'scheduled' WHERE id = ?`, [pollId])
}

export async function failSchedule(scheduleId: number, pollId: number) {
  await execute(`UPDATE poll_schedules SET status = 'failed', next_run_at = NULL WHERE id = ?`, [scheduleId])
  await execute(`UPDATE polls SET status = 'cancelled' WHERE id = ?`, [pollId])
}
