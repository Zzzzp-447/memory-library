import type { MindElixirData, NodeObj } from 'mind-elixir'
import type { StudyCard, Subject } from './study-library'
import { mapNodes } from './map-images'

export interface CardNodeMeta { kind?: string; cardId?: string; cardChapterId?: string; supplementKind?: string; supplementText?: string }
const clean = (text: string) => text.replace(/^第[一二三四五六七八九十\d]+章\s*/, '').replace(/\s/g, '')
const aliases: Record<string, string[]> = { '极限与连续': ['函数与极限'], '微分中值定理与应用': ['微分中值定理与导数的应用'], '定积分及其应用': ['定积分'] }

/** Cards are saved once. Their user-authored metadata supplies the map links without a second card write. */
export function attachCards(data: MindElixirData, subject: Subject, cards: StudyCard[]) {
  const next = structuredClone(data), attached = new Set<string>(next.meta?.attachedCardIds || []), nodes = mapNodes(next)
  for (const [index, card] of cards.entries()) {
    if (card.subjectId !== subject.id || attached.has(card.id)) continue
    const chapter = subject.chapters.find(item => item.id === card.chapterId)
    if (!chapter) continue
    if (nodes.some(node => (node.metadata as CardNodeMeta | undefined)?.cardId === card.id)) { attached.add(card.id); continue }
    const names = [chapter.name, ...(aliases[chapter.name] || [])].map(clean)
    let parent = nodes.find(node => (node.metadata as CardNodeMeta | undefined)?.cardChapterId === chapter.id)
      || nodes.find(node => !(node.metadata as CardNodeMeta | undefined)?.cardId && names.includes(clean(node.topic)))
    if (!parent) {
      parent = { id: crypto.randomUUID(), topic: chapter.name, direction: ((next.nodeData.children?.length || 0) % 2) as 0 | 1, children: [] }
      ;(next.nodeData.children ||= []).push(parent); nodes.push(parent)
    }
    parent.metadata = { ...(parent.metadata as object), cardChapterId: chapter.id }
    const supplement = card.mapSupplement
    if (supplement?.text.trim()) {
      const text = supplement.text.trim(), title = text.split(/\r?\n/)[0].slice(0, 80)
      let point = mapNodes({ nodeData: parent }).slice(1).find(node => {
        const meta = node.metadata as CardNodeMeta | undefined
        return !meta?.cardId && ((meta?.supplementKind === supplement.kind && meta.supplementText === text) || (!meta?.supplementText && node.topic === text))
      })
      if (!point) {
        point = { id: crypto.randomUUID(), topic: title, ...(text !== title ? { note: text } : {}), children: [], metadata: { supplementKind: supplement.kind, supplementText: text } }
        ;(parent.children ||= []).push(point); nodes.push(point)
      }
      parent = point
    }
    const link: NodeObj = { id: crypto.randomUUID(), topic: `题目 ${index + 1}`, style: { fontSize: '13px' }, metadata: { kind: 'card-link', cardId: card.id }, children: [] }
    ;(parent.children ||= []).push(link); nodes.push(link); attached.add(card.id)
  }
  if (attached.size) next.meta = { ...next.meta, attachedCardIds: [...attached] }
  return { data: next, changed: JSON.stringify(next) !== JSON.stringify(data) }
}

export function remapCardLinks(data: MindElixirData, cardIds: Map<string, string>, chapterIds: Map<string, string>, subjectId: string) {
  const next = structuredClone(data)
  for (const node of mapNodes(next)) {
    const meta = node.metadata as CardNodeMeta | undefined
    if (meta?.cardId && cardIds.has(meta.cardId)) meta.cardId = cardIds.get(meta.cardId)
    if (meta?.cardChapterId) meta.cardChapterId = chapterIds.get(`${subjectId}:${meta.cardChapterId}`) || meta.cardChapterId
  }
  if (next.meta?.attachedCardIds) next.meta.attachedCardIds = next.meta.attachedCardIds.map((id: string) => cardIds.get(id) || id)
  return next
}
