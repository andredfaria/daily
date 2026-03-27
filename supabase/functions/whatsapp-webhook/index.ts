import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const KEYWORDS = ['pago', 'ok', 'feito', 'confirmado', '✅']

Deno.serve(async (req) => {
  // Verify webhook secret
  const secret = req.headers.get('x-webhook-secret')
  if (secret !== Deno.env.get('WAHA_WEBHOOK_SECRET')) {
    return new Response('Unauthorized', { status: 401 })
  }

  const body = await req.json()

  // WAHA payload: body.event === 'message', body.payload.from, body.payload.body
  const event = body?.event
  if (event !== 'message') {
    return new Response('ignored', { status: 200 })
  }

  const from: string = body?.payload?.from ?? ''
  const text: string = (body?.payload?.body ?? '').toLowerCase().trim()
  const containsKeyword = KEYWORDS.some(k => text.includes(k))

  if (!containsKeyword) {
    return new Response('no keyword', { status: 200 })
  }

  // Normalize phone: remove @c.us suffix WAHA adds
  const phone = from.replace('@c.us', '').replace('@s.whatsapp.net', '')

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Find user by whatsapp_number
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .ilike('whatsapp_number', `%${phone}%`)
    .single()

  if (!user) {
    return new Response('user not found', { status: 200 })
  }

  // Find oldest pending occurrence for this user
  const { data: occurrence } = await supabase
    .from('bill_occurrences')
    .select('id, bill_id, amount, bill:bills(name, user_id)')
    .eq('status', 'pending')
    .eq('bill.user_id', user.id)
    .order('due_date', { ascending: true })
    .limit(1)
    .single()

  if (!occurrence) {
    return new Response('no pending occurrence', { status: 200 })
  }

  // Mark as paid
  await supabase
    .from('bill_occurrences')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      confirmation_source: 'whatsapp',
      whatsapp_msg: body?.payload?.body,
    })
    .eq('id', occurrence.id)

  // Cancel pending notifications
  await supabase
    .from('notifications')
    .update({ status: 'skipped' })
    .eq('bill_occurrence_id', occurrence.id)
    .eq('status', 'scheduled')

  // Send confirmation via WAHA
  const wahaUrl = Deno.env.get('WAHA_URL')
  const wahaKey = Deno.env.get('WAHA_API_KEY')
  const session = Deno.env.get('WAHA_SESSION') ?? 'default'
  const billName = (occurrence.bill as { name: string })?.name ?? 'conta'

  await fetch(`${wahaUrl}/api/sendText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': wahaKey ?? '',
    },
    body: JSON.stringify({
      session,
      chatId: from,
      text: `✅ Pagamento de *${billName}* registrado! Valor: R$ ${Number(occurrence.amount).toFixed(2)}`,
    }),
  })

  return new Response(JSON.stringify({ ok: true, occurrence_id: occurrence.id }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
