import type { Library, PaperColor, StudyCard } from './study-library'
import { recordReview } from './review-schedule'
import type { MindElixirData } from 'mind-elixir'

export interface MapValue { data: MindElixirData; source?: { title: string; url?: string; edition?: string } }
export interface WireCard extends Omit<StudyCard, 'front' | 'back'> { frontHash: string; backHash: string }
interface OperationBase { id: string; at: number; device: string; seq?: number }
export type CloudOperation = OperationBase & (
  { kind: 'subject'; body: { id: string; name: string; color: PaperColor; face: number } } |
  { kind: 'chapter'; body: { id: string; subjectId: string; name: string } } |
  { kind: 'card'; body: WireCard } |
  { kind: 'review'; body: { cardId: string; result: 'correct' | 'wrong'; at: number } } |
  { kind: 'goal'; body: { value: number } } |
  { kind: 'map'; body: { subjectId: string; parents: string[]; value: MapValue } }
)
export interface MapVersion { id: string; at: number; device: string; value: MapValue; head: boolean }
export interface CloudProjection { library: Library; wireCards: Record<string, WireCard>; maps: Record<string, MapVersion[]> }
const order = (a: CloudOperation, b: CloudOperation) => Number(a.seq === undefined) - Number(b.seq === undefined) || (a.seq ?? a.at) - (b.seq ?? b.at) || a.id.localeCompare(b.id)
export function canonical(value: unknown): string {
  const normalize = (item: unknown): unknown => Array.isArray(item) ? item.map(normalize) : item && typeof item === 'object' ? Object.fromEntries(Object.keys(item).sort().map(key => [key, normalize((item as Record<string, unknown>)[key])])) : item
  return JSON.stringify(normalize(value))
}
export function mergeOperations(existing: CloudOperation[], incoming: CloudOperation[]): CloudOperation[] {
  const operations = new Map(existing.map(op => [op.id, op]))
  for (const op of incoming) {
    const old = operations.get(op.id)
    if (old && canonical({ ...old, seq: undefined }) !== canonical({ ...op, seq: undefined })) throw new Error('同步记录校验不一致，本机资料已保留。')
    operations.set(op.id, { ...op, seq: op.seq ?? old?.seq })
  }
  return [...operations.values()].sort(order)
}
export function projectOperations(operations: CloudOperation[]): CloudProjection {
  const ordered = [...operations].sort(order)
  const subjects = new Map<string, Library['subjects'][number]>()
  const wireCards: Record<string, WireCard> = Object.create(null), maps: Record<string, MapVersion[]> = Object.create(null)
  const chapters: Extract<CloudOperation, { kind: 'chapter' }>[] = [], reviews: Extract<CloudOperation, { kind: 'review' }>[] = []
  const library: Library = { subjects: [], cards: [], reviewGoal: 6 }
  for (const op of ordered) {
    if (op.kind === 'subject' && !subjects.has(op.body.id)) subjects.set(op.body.id, { ...op.body, chapters: [] })
    else if (op.kind === 'chapter') chapters.push(op)
    else if (op.kind === 'card' && !wireCards[op.body.id]) wireCards[op.body.id] = { ...op.body }
    else if (op.kind === 'review') reviews.push(op)
    else if (op.kind === 'goal') library.reviewGoal = op.body.value
    else if (op.kind === 'map') {
      const versions = maps[op.body.subjectId] ||= []
      versions.push({ id: op.id, at: op.at, device: op.device, value: op.body.value, head: true })
    }
  }
  for (const op of chapters) {
    const subject = subjects.get(op.body.subjectId)
    if (subject && !subject.chapters.some(chapter => chapter.id === op.body.id)) subject.chapters.push({ id: op.body.id, name: op.body.name })
  }
  const cards: Record<string, StudyCard> = Object.create(null)
  for (const wire of Object.values(wireCards)) { const { frontHash: _front, backHash: _back, ...card } = wire; void _front; void _back; cards[card.id] = { ...card, front: '', back: '' } }
  reviews.sort((a, b) => a.body.at - b.body.at || a.id.localeCompare(b.id))
  for (const op of reviews) if (cards[op.body.cardId]) cards[op.body.cardId] = recordReview(cards[op.body.cardId], op.body.result, op.body.at)
  for (const op of ordered) if (op.kind === 'map') for (const version of maps[op.body.subjectId] || []) if (op.body.parents.includes(version.id)) version.head = false
  for (const versions of Object.values(maps)) versions.reverse()
  library.subjects = [...subjects.values()]
  library.cards = Object.values(cards)
  return { library, wireCards, maps }
}
