import { cloudRequest, getSession, profileKey, type CloudSession } from './cloud-session'
import { getCloudAsset, putCloudAsset, readCloudState, updateCloudState } from './cloud-store'
import { canonical, mergeOperations, projectOperations, type CloudOperation, type CloudProjection, type MapValue, type MapVersion } from './sync-model'
import type { Library } from './study-library'
import { syncReminderCards } from './reminders'
import { mapImages, mapAssetHash, mapAssetHashes, mapAssetPrefix } from './map-images'
import { remapCardLinks } from './card-mindmap'

interface Cache extends CloudProjection { generation: number }
export interface SyncStatus { phase: 'checking' | 'syncing' | 'idle' | 'error' | 'auth'; pending: number; lastSyncedAt?: number; message?: string }
const caches = new Map<string, Cache>(), statuses = new Map<string, SyncStatus>()
const running = new Map<string, Promise<void>>()
let timer: ReturnType<typeof setInterval> | undefined, clock = 0, startedUser = ''
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('memory-library-cloud') : null
const deviceKey = 'memory-library:device:v1'
function device() {
  let id = localStorage.getItem(deviceKey)
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(deviceKey, id) }
  const kind = /Android|iPhone/i.test(navigator.userAgent) ? /Mobile/i.test(navigator.userAgent) ? '手机' : '平板' : '电脑'
  return `${kind} · ${id.slice(0, 6)}`
}
function makeOperation<T extends CloudOperation['kind']>(kind: T, body: Extract<CloudOperation, { kind: T }>['body']): CloudOperation {
  clock = Math.max(Date.now(), clock + 1)
  return { id: crypto.randomUUID(), at: clock, device: device(), kind, body } as CloudOperation
}
function emit(userId: string, broadcast = false) {
  if (profileKey() === userId) window.dispatchEvent(new Event('memory-cloud-change'))
  if (broadcast) channel?.postMessage({ userId })
}
function status(userId: string, next: SyncStatus) { statuses.set(userId, next); emit(userId) }
export function getSyncStatus(): SyncStatus | null { const session = getSession(); return session ? statuses.get(session.user.id) || { phase: 'checking', pending: 0 } : null }
async function hash(bytes: Uint8Array<ArrayBuffer>) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('') }
function imageBytes(data: string) {
  const match = data.match(/^data:(image\/(?:jpeg|png|webp|gif|bmp));base64,([A-Za-z0-9+/=]+)$/)
  if (!match) throw new Error('卡片图片格式无法同步；原图仍保存在本机。')
  const bytes = Uint8Array.from(atob(match[2]), char => char.charCodeAt(0))
  return { bytes, mime: match[1] }
}
function imageData(bytes: Uint8Array, mime: string) {
  let binary = ''; for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768))
  return `data:${mime};base64,${btoa(binary)}`
}
async function cacheImage(userId: string, data: string) { const image = imageBytes(data), key = await hash(image.bytes); await putCloudAsset(userId, key, data); return key }
async function wireMap(userId: string, value: MapValue): Promise<MapValue> {
  const copy = structuredClone(value)
  for (const image of mapImages(copy.data)) if (image.url.startsWith('data:')) image.url = mapAssetPrefix + await cacheImage(userId, image.url)
  return copy
}
const operationAssets = (op: CloudOperation) => op.kind === 'card' ? [op.body.frontHash, op.body.backHash] : op.kind === 'map' ? mapAssetHashes(op.body.value.data) : []
async function downloadImage(session: CloudSession, key: string) {
  if (await getCloudAsset(session.user.id, key)) return
  const response = await cloudRequest(`/assets/${key}`, {}, session)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (await hash(bytes) !== key) throw new Error('下载图片校验失败，未推进同步位置，请重试。')
  const mime = response.headers.get('Content-Type')?.split(';')[0] || ''
  if (!/^image\/(jpeg|png|webp|gif|bmp)$/.test(mime)) throw new Error('下载图片类型不正确，未推进同步位置。')
  await putCloudAsset(session.user.id, key, imageData(bytes, mime))
}
async function refreshCache(userId: string) {
  const state = await readCloudState(userId), projected = projectOperations(state.operations)
  await Promise.all(projected.library.cards.map(async card => {
    const wire = projected.wireCards[card.id]
    const [front, back] = await Promise.all([getCloudAsset(userId, wire.frontHash), getCloudAsset(userId, wire.backHash)])
    if (!front || !back) throw new Error('本机图片尚未完整，请完成同步后重试。')
    card.front = front; card.back = back
  }))
  for (const versions of Object.values(projected.maps)) for (const version of versions) {
    version.value = structuredClone(version.value)
    for (const attachment of mapImages(version.value.data)) {
      const key = mapAssetHash(attachment.url)
      if (key) {
        const image = await getCloudAsset(userId, key)
        if (!image) throw new Error('导图图片尚未下载完整，请完成同步后重试。')
        attachment.url = image
      }
    }
  }
  if (!caches.has(userId) || caches.get(userId)!.generation < (state.generation || 0)) {
    caches.set(userId, { ...projected, generation: state.generation || 0 })
    if (profileKey() === userId) syncReminderCards(projected.library.cards, projected.library.reviewGoal || 6)
    emit(userId)
  }
  return structuredClone(caches.get(userId)!.library)
}
function checkedSession(expected: string) {
  const session = getSession()
  if (!session || session.user.id !== expected) throw new Error('账号已切换，请刷新后再保存；不会将资料写入另一个账号。')
  return session
}
export async function loadCloudLibrary(userId: string) {
  checkedSession(userId)
  const value = await refreshCache(userId)
  startCloudSync()
  return value
}
async function enqueue(userId: string, operations: CloudOperation[], importedGuest = false) {
  checkedSession(userId)
  const staged = await updateCloudState(userId, state => {
    if (importedGuest && state.importedGuest) throw new Error('本机资料已导入过此账号。')
    return { ...state, importedGuest: state.importedGuest || importedGuest, operations: mergeOperations(state.operations, operations) }
  })
  status(userId, { phase: running.has(userId) ? 'syncing' : 'checking', pending: staged.operations.filter(op => op.seq === undefined).length, lastSyncedAt: staged.lastSyncedAt })
  const value = await refreshCache(userId)
  emit(userId, true)
  void synchronize()
  return value
}
export async function saveCloudLibrary(value: Library, previous: Library, userId: string) {
  checkedSession(userId)
  const operations: CloudOperation[] = []
  for (const subject of value.subjects) {
    const old = previous.subjects.find(item => item.id === subject.id)
    if (!old) operations.push(makeOperation('subject', { id: subject.id, name: subject.name, color: subject.color, face: subject.face }))
    for (const chapter of subject.chapters) if (!old?.chapters.some(item => item.id === chapter.id)) operations.push(makeOperation('chapter', { ...chapter, subjectId: subject.id }))
  }
  for (const card of value.cards) {
    const old = previous.cards.find(item => item.id === card.id)
    if (!old) {
      const [frontHash, backHash] = await Promise.all([cacheImage(userId, card.front), cacheImage(userId, card.back)])
      const { front: _front, back: _back, ...metadata } = card; void _front; void _back
      operations.push(makeOperation('card', { ...metadata, frontHash, backHash }))
    } else {
      const correct = card.correct - old.correct, wrong = card.wrong - old.wrong
      if (correct || wrong) {
        if (!((correct === 1 && wrong === 0) || (wrong === 1 && correct === 0))) throw new Error('复习结果变化异常，本机记录尚未覆盖。')
        operations.push(makeOperation('review', { cardId: card.id, result: correct ? 'correct' : 'wrong', at: card.lastReviewedAt || Date.now() }))
      }
      if (card.front !== old.front || card.back !== old.back || canonical(card.tags) !== canonical(old.tags)) throw new Error('暂不支持直接覆盖云端卡片内容，请新增卡片以保留原记录。')
    }
  }
  if ((value.reviewGoal || 6) !== (previous.reviewGoal || 6)) operations.push(makeOperation('goal', { value: value.reviewGoal || 6 }))
  return enqueue(userId, operations)
}
export function cloudMapVersions(subjectId: string): MapVersion[] {
  const session = getSession()
  return session ? structuredClone(caches.get(session.user.id)?.maps[subjectId] || []) : []
}
export async function saveCloudMap(subjectId: string, value: MapValue, parent: string | undefined, userId: string): Promise<string> {
  const operation = makeOperation('map', { subjectId, parents: parent ? [parent] : [], value: await wireMap(userId, value) })
  await enqueue(userId, [operation])
  return operation.id
}
export async function importGuestLibrary(library: Library, maps: { subjectId: string; value: MapValue }[]) {
  const session = getSession(); if (!session) throw new Error('请先登录。')
  const state = await readCloudState(session.user.id)
  if (state.importedGuest) throw new Error('本机资料已导入过此账号；原本机资料仍保留。')
  const subjectIds = new Map(library.subjects.map(subject => [subject.id, crypto.randomUUID()])), chapterIds = new Map<string, string>()
  const imported: Library = { subjects: library.subjects.map(subject => ({ ...subject, id: subjectIds.get(subject.id)!, chapters: subject.chapters.map(chapter => { const id = crypto.randomUUID(); chapterIds.set(`${subject.id}:${chapter.id}`, id); return { ...chapter, id } }) })), cards: [] }
  const cardIds = new Map(library.cards.map(card => [card.id, crypto.randomUUID()]))
  imported.cards = library.cards.map(card => ({ ...card, id: cardIds.get(card.id)!, subjectId: subjectIds.get(card.subjectId)!, chapterId: chapterIds.get(`${card.subjectId}:${card.chapterId}`)! }))
  // Stage the entire import in one metadata transaction after caching every image.
  const operations: CloudOperation[] = []
  for (const subject of imported.subjects) { operations.push(makeOperation('subject', { id: subject.id, name: subject.name, color: subject.color, face: subject.face })); for (const chapter of subject.chapters) operations.push(makeOperation('chapter', { ...chapter, subjectId: subject.id })) }
  for (const card of imported.cards) {
    const [frontHash, backHash] = await Promise.all([cacheImage(session.user.id, card.front), cacheImage(session.user.id, card.back)])
    const { front: _front, back: _back, ...metadata } = card; void _front; void _back
    operations.push(makeOperation('card', { ...metadata, frontHash, backHash }))
  }
  for (const map of maps) if (subjectIds.has(map.subjectId)) operations.push(makeOperation('map', { subjectId: subjectIds.get(map.subjectId)!, parents: [], value: await wireMap(session.user.id, { ...map.value, data: remapCardLinks(map.value.data, cardIds, chapterIds, map.subjectId) }) }))
  operations.push(makeOperation('goal', { value: library.reviewGoal || 6 }))
  return enqueue(session.user.id, operations, true)
}
async function pull(session: CloudSession) {
  while (true) {
    const state = await readCloudState(session.user.id)
    const page = await (await cloudRequest(`/operations?cursor=${state.cursor}`, {}, session)).json() as { userId: string; operations: CloudOperation[]; nextCursor: number; hasMore: boolean; head: number }
    if (page.userId !== session.user.id) throw new Error('云端账号标识不一致，已停止写入本机资料。')
    if (!Array.isArray(page.operations) || !Number.isSafeInteger(page.nextCursor) || page.nextCursor < state.cursor) throw new Error('云端同步位置异常，本机资料已保留。')
    const images = [...new Set(page.operations.flatMap(operationAssets))]
    for (let i = 0; i < images.length; i += 4) await Promise.all(images.slice(i, i + 4).map(key => downloadImage(session, key)))
    await updateCloudState(session.user.id, current => ({ ...current, operations: mergeOperations(current.operations, page.operations), cursor: Math.max(current.cursor, page.nextCursor) }))
    if (!page.hasMore) break
    if (page.nextCursor === state.cursor) throw new Error('云端同步未能推进，请稍后重试。')
  }
}
export async function synchronize(): Promise<void> {
  const session = getSession(); if (!session) return
  const key = session.user.id
  if (running.has(key)) return running.get(key)
  const job = (async () => {
    try {
      const before = await readCloudState(key)
      status(key, { phase: 'syncing', pending: before.operations.filter(op => op.seq === undefined).length, lastSyncedAt: before.lastSyncedAt })
      await pull(session)
      while (true) {
        const state = await readCloudState(key), pending: CloudOperation[] = []
        let size = 0
        for (const op of state.operations.filter(item => item.seq === undefined)) {
          const length = new TextEncoder().encode(JSON.stringify(op)).length
          if (pending.length && (size + length > 750000 || pending.length >= 30)) break
          pending.push(op); size += length
        }
        if (!pending.length) break
        for (const op of pending) for (const image of [...new Set(operationAssets(op))]) {
          const data = await getCloudAsset(key, image); if (!data) throw new Error('本机图片缓存不完整，请保留应用数据并重试。')
          const file = imageBytes(data)
          if (await hash(file.bytes) !== image) throw new Error('本机图片校验失败，卡片未提交云端。')
          await cloudRequest(`/assets/${image}`, { method: 'PUT', headers: { 'Content-Type': file.mime }, body: file.bytes }, session)
        }
        const result = await (await cloudRequest('/operations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operations: pending.map(({ seq: _seq, ...op }) => { void _seq; return op }) }) }, session)).json() as { userId: string; acknowledged: { id: string; seq: number }[] }
        if (result.userId !== session.user.id || !Array.isArray(result.acknowledged)) throw new Error('云端尚未确认当前账号的保存，待上传记录已保留。')
        const confirmed = new Map(result.acknowledged.map(item => [item.id, item.seq]))
        if (pending.some(op => !Number.isSafeInteger(confirmed.get(op.id)))) throw new Error('部分记录尚未收到云端确认，请重试。')
        await updateCloudState(key, current => ({ ...current, operations: current.operations.map(op => confirmed.has(op.id) ? { ...op, seq: confirmed.get(op.id)! } : op) }))
      }
      await pull(session)
      const complete = await updateCloudState(key, current => ({ ...current, lastSyncedAt: current.operations.every(op => op.seq !== undefined) ? Date.now() : current.lastSyncedAt }))
      await refreshCache(key)
      status(key, { phase: complete.operations.some(op => op.seq === undefined) ? 'checking' : 'idle', pending: complete.operations.filter(op => op.seq === undefined).length, lastSyncedAt: complete.lastSyncedAt })
      emit(key, true)
    } catch (error) {
      const state = await readCloudState(key)
      status(key, { phase: (error as { status?: number }).status === 401 ? 'auth' : 'error', pending: state.operations.filter(op => op.seq === undefined).length, lastSyncedAt: state.lastSyncedAt, message: (error as Error).message })
    }
  })()
  running.set(key, job)
  try { await job } finally { running.delete(key); if (profileKey() === key && statuses.get(key)?.phase === 'checking' && statuses.get(key)?.pending) setTimeout(() => { void synchronize() }, 100) }
}
export function startCloudSync() {
  if (!timer) timer = setInterval(() => { if (!document.hidden) void synchronize() }, 15000)
  const id = getSession()?.user.id
  if (id && id !== startedUser) { startedUser = id; void synchronize() }
}
window.addEventListener('online', () => { void synchronize() })
window.addEventListener('focus', () => { if (getSession()) void synchronize() })
channel?.addEventListener('message', event => { if (event.data?.userId === profileKey()) { void refreshCache(event.data.userId); window.dispatchEvent(new Event('memory-cloud-change')) } })
