interface Ctx { request: Request }

const ALLOWED_HOSTS = ['bodeboca.com', 'www.bodeboca.com']

export async function onRequestGet({ request }: Ctx): Promise<Response> {
  const src = new URL(request.url).searchParams.get('url')
  if (!src) return new Response('Missing url', { status: 400 })

  let srcUrl: URL
  try { srcUrl = new URL(src) } catch { return new Response('Invalid url', { status: 400 }) }

  if (!ALLOWED_HOSTS.some(h => srcUrl.hostname === h || srcUrl.hostname.endsWith('.' + h)))
    return new Response('Forbidden', { status: 403 })

  const res = await fetch(src, {
    headers: {
      'Referer': 'https://www.bodeboca.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  })

  if (!res.ok) return new Response('Not found', { status: res.status })

  return new Response(res.body, {
    status: 200,
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
