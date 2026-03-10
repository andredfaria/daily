import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth-jwt'
import { createPollWithSchedule, listPollsByWorkspace } from '@/lib/db/polls'

interface CreatePollBody {
  question?: string
  options?: string[]
  scheduledAt?: string
  timezone?: string
  recipients?: string[]
}

function normalizeRecipients(recipients: string[]) {
  return [...new Set(recipients.map((item) => item.trim()).filter(Boolean))]
}

export async function GET() {
  try {
    const session = await getSessionFromCookies()
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const polls = await listPollsByWorkspace(session.userId)
    return NextResponse.json({ polls })
  } catch (error) {
    console.error('[polls GET] erro:', error)
    return NextResponse.json({ error: 'Erro ao listar enquetes' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookies()
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = (await request.json()) as CreatePollBody
    const question = body.question?.trim()
    const options = (body.options ?? []).map((option) => option.trim()).filter(Boolean)
    const recipients = normalizeRecipients(body.recipients ?? [])

    if (!question) {
      return NextResponse.json({ error: 'Pergunta é obrigatória' }, { status: 400 })
    }

    if (options.length < 2) {
      return NextResponse.json({ error: 'A enquete deve ter no mínimo 2 opções' }, { status: 400 })
    }

    if (recipients.length === 0) {
      return NextResponse.json({ error: 'Informe ao menos 1 destinatário' }, { status: 400 })
    }

    if (!body.scheduledAt) {
      return NextResponse.json({ error: 'scheduledAt é obrigatório' }, { status: 400 })
    }

    const scheduledAt = new Date(body.scheduledAt)
    if (Number.isNaN(scheduledAt.getTime())) {
      return NextResponse.json({ error: 'scheduledAt inválido. Use ISO-8601 com timezone.' }, { status: 400 })
    }

    const poll = await createPollWithSchedule({
      workspaceId: session.userId,
      createdBy: session.userId,
      question,
      options,
      scheduledAt,
      timezone: body.timezone?.trim() || 'UTC',
      recipients,
    })

    return NextResponse.json({ poll }, { status: 201 })
  } catch (error) {
    console.error('[polls POST] erro:', error)
    return NextResponse.json({ error: 'Erro ao criar enquete' }, { status: 500 })
  }
}
