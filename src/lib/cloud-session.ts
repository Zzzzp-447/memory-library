export const CLOUD_URL = (import.meta.env.VITE_SYNC_URL || 'https://memory-library-sync.ksq635279589.chatgpt.site').replace(/\/$/, '')
const KEY = 'memory-library:session:v1'
export interface CloudSession { user: { id: string; email: string }; token: string; expiresAt: number }
export function getSession(): CloudSession | null {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || 'null') as CloudSession | null
    return value?.user?.id && typeof value.token === 'string' ? value : null
  } catch { return null }
}
export const profileKey = () => getSession()?.user.id || 'guest'
export function setSession(value: CloudSession | null) {
  if (value) localStorage.setItem(KEY, JSON.stringify(value)); else localStorage.removeItem(KEY)
  window.dispatchEvent(new Event('memory-account-change'))
}
export async function cloudRequest(path: string, init: RequestInit = {}, session: CloudSession | null = getSession()) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000)
  const headers = new Headers(init.headers)
  if (session) headers.set('Authorization', `Bearer ${session.token}`)
  try {
    const response = await fetch(`${CLOUD_URL}/api/v1${path}`, { ...init, headers, signal: controller.signal })
    if (!response.ok) {
      let message = '同步服务暂不可用，未上传资料仍保留在本机。'
      try { message = (await response.json()).error || message } catch { /* Keep the fallback. */ }
      throw Object.assign(new Error(message), { status: response.status })
    }
    return response
  } catch (error) {
    if (error instanceof Error && 'status' in error) throw error
    throw new Error('暂时无法连接云端；修改已保存在本机，联网后可重试。')
  } finally { clearTimeout(timer) }
}
export async function authenticate(mode: 'login' | 'register' | 'reset-password', email: string, password: string, recoveryCode?: string): Promise<CloudSession & { recoveryCode?: string }> {
  const response = await cloudRequest(`/${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, recoveryCode }) }, null)
  const session = await response.json()
  return session
}
export async function signOut() {
  const session = getSession()
  try { if (session) await cloudRequest('/logout', { method: 'POST' }, session) } catch { /* Local account data and pending writes are deliberately retained. */ }
  if (getSession()?.token !== session?.token) return
  setSession(null)
  window.location.assign('/')
}

window.addEventListener('storage', event => { if (event.key === KEY) window.location.reload() })
