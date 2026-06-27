import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface BookmarkletWine {
  name: string
  winery: string
  vintage_year: number | null
  purchase_date: string
  price_per_bottle: number
  units_purchased: number
  region: string | null
  source_order_id: string | null
  label_image_url: string | null
}

export const handler: Handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': 'https://www.bodeboca.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' }
  }

  try {
    const { token, wines } = JSON.parse(event.body ?? '{}') as {
      token: string
      wines: BookmarkletWine[]
    }

    if (!token || !wines?.length) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Token o vinos faltantes' }) }
    }

    // Verify the Supabase JWT to identify the user — no custom token table needed
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) {
      console.error('JWT verification failed:', authErr?.message)
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Sesión inválida. Genera un nuevo enlace desde la app.' }) }
    }

    const userId = user.id

    // Deduplicate: skip wines already in pending_wines or wines table
    const orderIds = wines.map(w => w.source_order_id).filter(Boolean) as string[]

    const [{ data: existingPending }, { data: existingWines }] = await Promise.all([
      supabase.from('pending_wines').select('source_order_id').eq('user_id', userId).in('source_order_id', orderIds),
      supabase.from('wines').select('source_order_id').eq('user_id', userId).in('source_order_id', orderIds),
    ])

    const existingIds = new Set([
      ...((existingPending ?? []).map(r => r.source_order_id)),
      ...((existingWines ?? []).map(r => r.source_order_id)),
    ])

    const toInsert = wines
      .filter(w => w.source_order_id && !existingIds.has(w.source_order_id))
      .map(w => ({ ...w, user_id: userId }))

    if (toInsert.length > 0) {
      const { error: insertErr } = await supabase.from('pending_wines').insert(toInsert)
      if (insertErr) {
        console.error('Insert error:', insertErr.message)
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error al guardar: ' + insertErr.message }) }
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        imported: toInsert.length,
        skipped: wines.length - toInsert.length,
      }),
    }
  } catch (err) {
    console.error(err)
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error interno' }) }
  }
}
