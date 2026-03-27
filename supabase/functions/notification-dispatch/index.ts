import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const today = new Date().toISOString().split('T')[0]

  // Fetch due-today notifications with occurrence + bill + primary payment method
  const { data: notifications, error } = await supabase
    .from('notifications')
    .select(`
      id, type,
      occurrence:bill_occurrences (
        id, due_date, amount,
        bill:bills (
          name,
          user:users (whatsapp_number),
          payment_methods (type, pix_key_type, pix_key, pix_beneficiary, boleto_code, is_primary)
        )
      )
    `)
    .eq('scheduled_for', today)
    .eq('status', 'scheduled')

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  const wahaUrl = Deno.env.get('WAHA_URL')
  const wahaKey = Deno.env.get('WAHA_API_KEY') ?? ''
  const session = Deno.env.get('WAHA_SESSION') ?? 'default'
  const results = { sent: 0, failed: 0 }

  for (const notif of notifications ?? []) {
    const occ = notif.occurrence as {
      id: string
      due_date: string
      amount: number
      bill: {
        name: string
        user: { whatsapp_number: string }
        payment_methods: {
          type: string
          pix_key_type?: string
          pix_key?: string
          pix_beneficiary?: string
          boleto_code?: string
          is_primary: boolean
        }[]
      }
    }

    if (!occ?.bill?.user?.whatsapp_number) continue

    const primary = occ.bill.payment_methods?.find(m => m.is_primary)
      ?? occ.bill.payment_methods?.[0]

    const dueFormatted = new Date(occ.due_date + 'T12:00:00').toLocaleDateString('pt-BR')
    const amount = `R$ ${Number(occ.amount).toFixed(2)}`
    const daysLabel = notif.type === 'before_due' ? 'vence em breve' : 'vence *hoje*'

    let paymentInfo = ''
    if (primary?.type === 'pix' && primary.pix_key) {
      paymentInfo = `\n💳 PIX: \`${primary.pix_key}\` (${primary.pix_beneficiary ?? ''})`
    } else if (primary?.type === 'boleto' && primary.boleto_code) {
      paymentInfo = `\n🏦 Boleto: \`${primary.boleto_code}\``
    }

    const message =
      `🔔 *${occ.bill.name}* ${daysLabel}!\n` +
      `📅 Vencimento: ${dueFormatted}\n` +
      `💰 Valor: ${amount}` +
      paymentInfo +
      `\n\nResponda *pago* para confirmar o pagamento.`

    try {
      const res = await fetch(`${wahaUrl}/api/sendText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': wahaKey },
        body: JSON.stringify({
          session,
          chatId: occ.bill.user.whatsapp_number + '@c.us',
          text: message,
        }),
      })

      const wahaData = await res.json().catch(() => ({}))
      const msgId = wahaData?.id ?? wahaData?.key?.id ?? null

      await supabase
        .from('notifications')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          waha_message_id: msgId,
          message_body: message,
        })
        .eq('id', notif.id)

      results.sent++
    } catch (err) {
      await supabase
        .from('notifications')
        .update({ status: 'failed', error_detail: String(err) })
        .eq('id', notif.id)

      results.failed++
    }
  }

  return new Response(JSON.stringify({ ok: true, today, ...results }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
