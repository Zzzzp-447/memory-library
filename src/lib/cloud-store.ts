import type { CloudOperation } from './sync-model'

export interface CloudState { operations: CloudOperation[]; cursor: number; generation?: number; lastSyncedAt?: number; importedGuest?: boolean }
let opening: Promise<IDBDatabase> | undefined
function database() {
  if (!opening) opening = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('memory-library-cloud', 1)
    request.onupgradeneeded = () => { request.result.createObjectStore('profiles'); request.result.createObjectStore('assets') }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => { opening = undefined; reject(request.error) }
    request.onblocked = () => { opening = undefined; reject(new Error('请关闭旧版本的资料库窗口后重试。')) }
  })
  return opening
}
export async function readCloudState(userId: string): Promise<CloudState> {
  const db = await database()
  return new Promise((resolve, reject) => {
    const request = db.transaction('profiles').objectStore('profiles').get(userId)
    request.onsuccess = () => resolve(request.result || { operations: [], cursor: 0 })
    request.onerror = () => reject(request.error)
  })
}
// Read-modify-write stays inside one native transaction, including across tabs.
export async function updateCloudState(userId: string, change: (state: CloudState) => CloudState): Promise<CloudState> {
  const db = await database()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('profiles', 'readwrite'), store = transaction.objectStore('profiles'), request = store.get(userId)
    let next: CloudState
    request.onsuccess = () => {
      try { const old = request.result || { operations: [], cursor: 0 }; next = { ...change(old), generation: (old.generation || 0) + 1 }; store.put(next, userId) }
      catch (error) { transaction.abort(); reject(error) }
    }
    transaction.oncomplete = () => resolve(next)
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error || new Error('本机保存未完成，请保留当前页面重试。'))
  })
}
export async function putCloudAsset(userId: string, hash: string, data: string): Promise<void> {
  const db = await database()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('assets', 'readwrite')
    transaction.objectStore('assets').put(data, `${userId}:${hash}`)
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}
export async function getCloudAsset(userId: string, hash: string): Promise<string | undefined> {
  const db = await database()
  return new Promise((resolve, reject) => {
    const request = db.transaction('assets').objectStore('assets').get(`${userId}:${hash}`)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
