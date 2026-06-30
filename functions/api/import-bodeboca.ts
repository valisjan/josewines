import { createClient, SupabaseClient } from '@supabase/supabase-js'

interface Env {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
}

interface Ctx {
  request: Request
  env: Env
}

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

const CORS = {
  'Access-Control-Allow-Origin': 'https://www.bodeboca.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// Download a Bodeboca image and upload to Supabase Storage.
// Returns the Supabase public URL, or the original URL if anything fails.
async function cacheImage(
  url: string,
  userId: string,
  sourceOrderId: string,
  supabase: SupabaseClient
): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        'Referer': 'https://www.bodeboca.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })
    if (!res.ok) return url

    const buffer = await res.arrayBuffer()
    const ct = res.headers.get('Content-Type') ?? 'image/jpeg'
    const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg'
    const path = `${userId}/${sourceOrderId}.${ext}`

    const { error } = await supabase.storage
      .from('wine-labels')
      .upload(path, buffer, { contentType: ct, upsert: true })

    if (error) return url

    const { data } = supabase.storage.from('wine-labels').getPublicUrl(path)
    return data.publicUrl
  } catch {
    return url
  }
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, { status: 200, headers: CORS })
}

export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })

  try {
    const { token, wines } = await request.json() as { token: string; wines: BookmarkletWine[] }

    if (!token || !wines?.length) {
      return json({ error: 'Token o vinos faltantes' }, 400)
    }

    const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) {
      console.error('JWT verification failed:', authErr?.message)
      return json({ error: 'Sesión inválida. Genera un nuevo enlace desde la app.' }, 401)
    }

    const userId = user.id
    const orderIds = wines.map(w => w.source_order_id).filter(Boolean) as string[]

    // Batch .in() queries to stay within PostgREST URL limits (~20 UUIDs per batch)
    const BATCH = 20
    const existingPending: { source_order_id: string; label_image_url: string | null }[] = []
    const existingWines:   { source_order_id: string; label_image_url: string | null }[] = []

    for (let i = 0; i < orderIds.length; i += BATCH) {
      const slice = orderIds.slice(i, i + BATCH)
      const [{ data: pd }, { data: wd }] = await Promise.all([
        supabase.from('pending_wines').select('source_order_id, label_image_url').eq('user_id', userId).in('source_order_id', slice),
        supabase.from('wines').select('source_order_id, label_image_url').eq('user_id', userId).in('source_order_id', slice),
      ])
      existingPending.push(...(pd ?? []))
      existingWines.push(...(wd ?? []))
    }

    const pendingMap = new Map(existingPending.map(r => [r.source_order_id, r.label_image_url]))
    const winesMap   = new Map(existingWines.map(r => [r.source_order_id, r.label_image_url]))

    const toInsert: (BookmarkletWine & { user_id: string })[] = []
    const imagesToPatchPending: { source_order_id: string; img: string }[] = []
    const imagesToPatchWines:   { source_order_id: string; img: string }[] = []

    for (const w of wines) {
      if (!w.source_order_id) continue
      const inPending = pendingMap.has(w.source_order_id)
      const inWines   = winesMap.has(w.source_order_id)

      if (!inPending && !inWines) {
        toInsert.push({ ...w, user_id: userId })
      } else if (w.label_image_url) {
        if (inPending && !pendingMap.get(w.source_order_id))
          imagesToPatchPending.push({ source_order_id: w.source_order_id, img: w.label_image_url })
        if (inWines && !winesMap.get(w.source_order_id))
          imagesToPatchWines.push({ source_order_id: w.source_order_id, img: w.label_image_url })
      }
    }

    // Cache images for new inserts (download from Bodeboca, upload to Supabase Storage)
    await Promise.all(
      toInsert.map(async w => {
        if (w.label_image_url && w.source_order_id) {
          w.label_image_url = await cacheImage(w.label_image_url, userId, w.source_order_id, supabase)
        }
      })
    )

    // Cache images for patches too
    await Promise.all([
      ...imagesToPatchPending.map(async p => {
        p.img = await cacheImage(p.img, userId, p.source_order_id, supabase)
      }),
      ...imagesToPatchWines.map(async p => {
        p.img = await cacheImage(p.img, userId, p.source_order_id, supabase)
      }),
    ])

    const ops: Promise<unknown>[] = []

    if (toInsert.length > 0)
      ops.push(supabase.from('pending_wines').insert(toInsert).then(({ error }) => {
        if (error) throw new Error('Insert error: ' + error.message)
      }))

    for (const p of imagesToPatchPending)
      ops.push(supabase.from('pending_wines').update({ label_image_url: p.img }).eq('user_id', userId).eq('source_order_id', p.source_order_id))

    for (const p of imagesToPatchWines)
      ops.push(supabase.from('wines').update({ label_image_url: p.img }).eq('user_id', userId).eq('source_order_id', p.source_order_id))

    await Promise.all(ops)

    const patched = imagesToPatchPending.length + imagesToPatchWines.length
    return json({ imported: toInsert.length, skipped: wines.length - toInsert.length - patched, patched })
  } catch (err) {
    console.error(err)
    return json({ error: 'Error interno' }, 500)
  }
}
