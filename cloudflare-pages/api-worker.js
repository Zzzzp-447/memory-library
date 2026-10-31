// Pages advanced-mode worker. Account storage remains in the existing backend.
const upstream = 'https://memory-library-sync.ksq635279589.chatgpt.site'
export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/api/v1/')) return env.ASSETS.fetch(request)
    const origin = request.headers.get('Origin')
    if (origin && origin !== url.origin) return new Response('Origin not allowed', { status: 403 })
    const target = new URL(url.pathname + url.search, upstream)
    const headers = new Headers(request.headers)
    headers.delete('Host'); headers.delete('Cookie')
    if (origin) headers.set('Origin', upstream)
    try {
      const response = await fetch(new Request(target, { method: request.method, headers, body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body, redirect: 'manual' }))
      const result = new Headers(response.headers)
      result.set('Cache-Control', 'no-store')
      result.delete('Set-Cookie')
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers: result })
    } catch {
      return Response.json({ error: '云端暂时无法连接，本机资料保留，请稍后重试。' }, { status: 502, headers: { 'Cache-Control': 'no-store' } })
    }
  }
}
