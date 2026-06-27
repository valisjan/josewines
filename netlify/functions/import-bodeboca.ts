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

    // Validate token
    const { data: tokenRow } = await supabase
      .from('import_tokens')
      .select('user_id, used, expires_at')
      .eq('token', token)
      .single()

    if (!tokenRow) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token inválido' }) }
    }
    if (new Date(tokenRow.expires_at) < new Date()) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token expirado' }) }
    }

    const userId = tokenRow.user_id

    // Check for duplicates by order ID to avoid re-importing
    const orderIds = wines.map(w => w.source_order_id).filter(Boolean)
    const { data: existing } = await supabase
      .from('pending_wines')
      .select('source_order_id')
      .eq('user_id', userId)
      .in('source_order_id', orderIds)

    const existingIds = new Set((existing ?? []).map(r => r.source_order_id))

    const { data: existingWines } = await supabase
      .from('wines')
      .select('source_order_id')
      .eq('user_id', userId)
      .in('source_order_id', orderIds)

    const existingWineIds = new Set((existingWines ?? []).map(r => r.source_order_id))

    const toInsert = wines
      .filter(w => !existingIds.has(w.source_order_id) && !existingWineIds.has(w.source_order_id))
      .map(w => ({ ...w, user_id: userId }))

    if (toInsert.length > 0) {
      await supabase.from('pending_wines').insert(toInsert)
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
