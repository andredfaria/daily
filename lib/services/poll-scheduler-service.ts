import {
  DuePollSchedule,
  failSchedule,
  finalizeScheduleProcessed,
  getDuePollSchedules,
  getPollById,
  listPendingDispatches,
  markDispatchFailed,
  markDispatchSent,
  markScheduleProcessing,
  scheduleRetry,
} from '@/lib/db/polls'

interface WAHASendResponse {
  id?: string
}

export interface PollSchedulerResult {
  checkedSchedules: number
  processedSchedules: number
  totalSent: number
  totalFailed: number
}

function getWAHAHeaders() {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    accept: 'application/json',
  }

  if (process.env.WAHA_API_KEY) {
    headers['X-Api-Key'] = process.env.WAHA_API_KEY
  }

  return headers
}

function buildPollMessage(question: string, options: Array<{ label: string }>) {
  const lines = options.map((option, index) => `${index + 1}. ${option.label}`)
  return `${question}\n\n${lines.join('\n')}\n\nResponda com o número da opção desejada.`
}

async function sendPollMessage(params: {
  recipientPhone: string
  question: string
  options: Array<{ label: string }>
}) {
  const wahaBaseUrl = process.env.WAHA_BASE_URL
  if (!wahaBaseUrl) {
    throw new Error('WAHA_BASE_URL não configurado')
  }

  const endpoint = `${wahaBaseUrl.replace(/\/$/, '')}/api/sendText`
  const payload = {
    chatId: params.recipientPhone,
    text: buildPollMessage(params.question, params.options),
    session: 'default',
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: getWAHAHeaders(),
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`WAHA error ${response.status}: ${body || response.statusText}`)
  }

  const data = (await response.json()) as WAHASendResponse
  return data.id
}

async function processSingleSchedule(schedule: DuePollSchedule): Promise<{ sent: number; failed: number }> {
  await markScheduleProcessing(schedule.schedule_id)

  const dispatches = await listPendingDispatches(schedule.poll_id)
  if (dispatches.length === 0) {
    await finalizeScheduleProcessed(schedule.schedule_id, schedule.poll_id)
    return { sent: 0, failed: 0 }
  }

  const pollInfo = await getPollById(schedule.poll_id)
  if (!pollInfo) {
    await failSchedule(schedule.schedule_id, schedule.poll_id)
    return { sent: 0, failed: dispatches.length }
  }

  let sent = 0
  let failed = 0

  for (const dispatch of dispatches) {
    try {
      const messageId = await sendPollMessage({
        recipientPhone: dispatch.recipient_phone,
        question: pollInfo.question,
        options: pollInfo.options,
      })
      await markDispatchSent(dispatch.id, messageId)
      sent += 1
    } catch (error) {
      await markDispatchFailed(
        dispatch.id,
        error instanceof Error ? error.message : 'Erro desconhecido no envio'
      )
      failed += 1
    }
  }

  if (failed === 0) {
    await finalizeScheduleProcessed(schedule.schedule_id, schedule.poll_id)
  } else if (schedule.attempt_count >= 5) {
    await failSchedule(schedule.schedule_id, schedule.poll_id)
  } else {
    await scheduleRetry(schedule.schedule_id, schedule.poll_id, schedule.attempt_count + 1)
  }

  return { sent, failed }
}

export async function runPollScheduler(limit = 25): Promise<PollSchedulerResult> {
  const schedules = await getDuePollSchedules(limit)
  let processedSchedules = 0
  let totalSent = 0
  let totalFailed = 0

  for (const schedule of schedules) {
    const scheduleResult = await processSingleSchedule(schedule)
    processedSchedules += 1
    totalSent += scheduleResult.sent
    totalFailed += scheduleResult.failed
  }

  return {
    checkedSchedules: schedules.length,
    processedSchedules,
    totalSent,
    totalFailed,
  }
}
