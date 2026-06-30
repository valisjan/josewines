export function proxyImg(url: string | null | undefined): string | null {
  if (!url) return null
  if (url.includes('bodeboca.com')) return `/api/img?url=${encodeURIComponent(url)}`
  return url
}
