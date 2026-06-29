import { createClient } from '@supabase/supabase-js'

interface Env {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
}

interface Ctx {
  request: Request
  env: Env
}

interface ParsedWine {
  name: string
  winery: string
  region: string | null
  vintage_year: number | null
  price_per_bottle: number
  units_purchased: number
  purchase_date: string
  source_order_id: string | null
  raw_email_snippet: string | null
}

function parseBodbocaEmail(body: string, subject: string): ParsedWine[] {
  const wines: ParsedWine[] = []

  const dateMatch = body.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/) ??
                    body.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/)
  const purchaseDate = dateMatch
    ? new Date(body.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/)
        ? `${dateMatch[1]}-${dateMatch[2].padStart(2,'0')}-${dateMatch[3].padStart(2,'0')}`
        : `${dateMatch[3]}-${dateMatch[2].padStart(2,'0')}-${dateMatch[1].padStart(2,'0')}`
    ).toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0]

  const orderMatch = body.match(/[Pp]edido[:\s#]*([A-Z0-9\-]+)/) ??
                     body.match(/[Oo]rder[:\s#]*([A-Z0-9\-]+)/)
  const orderId = orderMatch?.[1] ?? null

  const winePattern = /([A-ZÁÉÍÓÚÑ][^\n]{5,60}?)\s+(\d{4})\s+x\s*(\d+)\s+.*?(\d+[.,]\d{2})\s*€/gi
  let match
  while ((match = winePattern.exec(body)) !== null) {
    const [, rawName, vintage, units, rawPrice] = match
    const price = parseFloat(rawPrice.replace(',', '.'))
    wines.push({
      name: rawName.trim(),
      winery: extractWinery(rawName.trim()),
      region: null,
      vintage_year: parseInt(vintage),
      price_per_bottle: price / parseInt(units),
      units_purchased: parseInt(units),
      purchase_date: purchaseDate,
      source_order_id: orderId,
      raw_email_snippet: match[0].substring(0, 300),
    })
  }

  if (wines.length === 0) {
    const simplePattern = /([A-ZÁÉÍÓÚÑ][^\n]{5,60}?)\s+x\s*(\d+)\s+.*?(\d+[.,]\d{2})\s*€/gi
    while ((match = simplePattern.exec(body)) !== null) {
      const [, rawName, units, rawPrice] = match
      const price = parseFloat(rawPrice.replace(',', '.'))
      const vintageInName = rawName.match(/\b(19|20)\d{2}\b/)
      wines.push({
        name: rawName.trim(),
        winery: extractWinery(rawName.trim()),
        region: null,
        vintage_year: vintageInName ? parseInt(vintageInName[0]) : null,
        price_per_bottle: price / parseInt(units),
        units_purchased: parseInt(units),
        purchase_date: purchaseDate,
        source_order_id: orderId,
        raw_email_snippet: match[0].substring(0, 300),
      })
    }
  }

  return wines
}

function extractWinery(wineName: string): string {
  const prefixMatch = wineName.match(/^(Bodegas?\s+\w+)/i)
  if (prefixMatch) return prefixMatch[1]
  const words = wineName.split(/\s+/)
  return words.slice(0, Math.min(2, words.length)).join(' ')
}

export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  try {
    const bodyText = await request.text()
    const params = new URLSearchParams(bodyText)
    const subject = params.get('subject') ?? ''
    const bodyPlain = params.get('body-plain') ?? ''
    const recipient = params.get('recipient') ?? ''

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

    const emailPrefix = recipient.split('@')[0]
    const { data: profile } = await supabase
      .from('user_email_aliases')
      .select('user_id')
      .eq('alias', emailPrefix)
      .single()

    if (!profile) {
      return new Response('User not found', { status: 404 })
    }

    const parsed = parseBodbocaEmail(bodyPlain, subject)

    if (parsed.length === 0) {
      return new Response(JSON.stringify({ message: 'No wines found in email', parsed: 0 }), { status: 200 })
    }

    const rows = parsed.map(w => ({ ...w, user_id: profile.user_id }))
    const { error } = await supabase.from('pending_wines').insert(rows)

    if (error) throw error

    return new Response(JSON.stringify({ message: 'OK', parsed: parsed.length }), { status: 200 })
  } catch (err) {
    console.error('parse-email error:', err)
    return new Response('Internal error', { status: 500 })
  }
}
