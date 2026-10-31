export type OfflineStatus = 'preparing' | 'ready' | 'unavailable' | 'error'
let status: OfflineStatus = 'preparing'
export const offlineStatus = () => status
const notify = (next: OfflineStatus) => { status = next; window.dispatchEvent(new Event('memory-offline-status')) }
export async function registerPwa() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || !window.isSecureContext || location.hostname === 'appassets.androidplatform.net') { notify('unavailable'); return }
  try {
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type === 'memory-library-offline-status' && ['ready', 'error'].includes(event.data.status)) notify(event.data.status)
    })
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
    const prepare = () => registration.active?.postMessage({ type: 'memory-library-prepare' })
    navigator.serviceWorker.addEventListener('controllerchange', prepare)
    window.addEventListener('online', prepare)
    const observe = () => {
      const worker = registration.installing
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'redundant' && !registration.active) notify('error')
      })
    }
    observe(); registration.addEventListener('updatefound', observe)
    await navigator.serviceWorker.ready
    prepare()
  } catch { notify('error') }
}
