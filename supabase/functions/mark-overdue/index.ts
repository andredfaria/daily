import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const today = new Date().toISOString().split('T')[0]

  const { count, error } = await supabase
    .from('bill_occurrences')
    .update({ status: 'overdue' })
    .lt('due_date', today)
    .eq('status', 'pending')
    .select('id', { count: 'exact', head: true })

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  return new Response(JSON.stringify({ ok: true, marked_overdue: count }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
