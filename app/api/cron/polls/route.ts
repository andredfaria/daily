import { NextRequest, NextResponse } from 'next/server'
import { runPollScheduler } from '@/lib/services/poll-scheduler-service'

function isAuthorized(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return true

  const bearerToken = request.headers.get('authorization')?.replace('Bearer ', '')
  return bearerToken === cronSecret
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const result = await runPollScheduler()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error('[cron polls POST] erro:', error)
    return NextResponse.json({ error: 'Erro no processamento do scheduler' }, { status: 500 })
  }
}
