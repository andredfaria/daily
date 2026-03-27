import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async () => {
  const wahaUrl = Deno.env.get('WAHA_URL')
  const wahaKey = Deno.env.get('WAHA_API_KEY') ?? ''
  const session = Deno.env.get('WAHA_SESSION') ?? 'default'

  try {
    const res = await fetch(`${wahaUrl}/api/sessions/${session}`, {
      headers: { 'X-Api-Key': wahaKey },
    })
    const data = await res.json()
    return new Response(
      JSON.stringify({ connected: data?.status === 'WORKING', session }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch {
    return new Response(
      JSON.stringify({ connected: false }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
