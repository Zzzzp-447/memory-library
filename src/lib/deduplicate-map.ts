import type { MindElixirData, NodeObj } from 'mind-elixir'

/** Merge only siblings: a repeated title in a different chapter is not a duplicate. */
export function deduplicateMap(data: MindElixirData) {
  const next = structuredClone(data), aliases = new Map<string, string>()
  let merged = 0
  const nodes = (root: NodeObj): NodeObj[] => [root, ...(root.children || []).flatMap(nodes)]
  const before = new Map(nodes(next.nodeData).map(node => [node.id, node]))
  const ranges = next.summaries?.map(summary => ({ summary, ids: before.get(summary.parent)?.children?.slice(summary.start, summary.end + 1).map(node => node.id) || [] }))
  const resolve = (id: string): string => aliases.has(id) ? resolve(aliases.get(id)!) : id
  const key = (node: NodeObj) => {
    const cardId = (node.metadata as { cardId?: string } | undefined)?.cardId
    const title = node.topic.normalize('NFKC').replace(/\s/g, '').toLowerCase()
    if (!title || /^(newnode|newtopic|新节点|新主题|新分支)$/.test(title)) return `draft:${node.id}`
    return cardId ? `card:${cardId}` : `topic:${title}`
  }
  const merge = (keep: NodeObj, extra: NodeObj) => {
    merged++
    if (extra.id !== keep.id) aliases.set(extra.id, keep.id)
    if (extra.note && keep.note !== extra.note) keep.note = keep.note ? `${keep.note}\n\n${extra.note}` : extra.note
    if (extra.tags) keep.tags = [...new Map([...(keep.tags || []), ...extra.tags].map(tag => [JSON.stringify(tag), tag])).values()]
    const metadata = { ...(extra.metadata as object), ...(keep.metadata as object) } as Record<string, unknown>
    const attachment = (extra.metadata as { imageAttachment?: unknown } | undefined)?.imageAttachment
    const keptAttachment = (keep.metadata as { imageAttachment?: unknown } | undefined)?.imageAttachment
    // Keep distinct attachments as a child rather than overwriting either image.
    const extraImage = extra.image && keep.image && JSON.stringify(attachment || extra.image) !== JSON.stringify(keptAttachment || keep.image)
    if (extraImage && !keptAttachment) delete metadata.imageAttachment
    if (extraImage) (keep.children ||= []).push({ id: crypto.randomUUID(), topic: '图片附件', image: extra.image, metadata: attachment ? { imageAttachment: attachment } : undefined })
    if (!keep.image && extra.image) keep.image = extra.image
    if (extra.hyperLink && keep.hyperLink && extra.hyperLink !== keep.hyperLink) (keep.children ||= []).push({ id: crypto.randomUUID(), topic: '补充链接', hyperLink: extra.hyperLink })
    else if (!keep.hyperLink && extra.hyperLink) keep.hyperLink = extra.hyperLink
    if (Object.keys(metadata).length) keep.metadata = metadata
    if (extra.icons) keep.icons = [...new Set([...(keep.icons || []), ...extra.icons])]
    keep.children = [...(keep.children || []), ...(extra.children || [])]
  }
  const visit = (parent: NodeObj) => {
    if (!parent.children) return
    const seen = new Map<string, NodeObj>(), children: NodeObj[] = []
    for (const child of parent.children) {
      const existing = seen.get(key(child))
      if (existing) merge(existing, child)
      else { seen.set(key(child), child); children.push(child) }
    }
    parent.children = children
    children.forEach(visit)
  }
  visit(next.nodeData)
  if (!merged) return { data: next, changed: false }
  if (next.arrows) next.arrows = next.arrows.map(arrow => ({ ...arrow, from: resolve(arrow.from), to: resolve(arrow.to) }))
  if (ranges) {
    const after = new Map(nodes(next.nodeData).map(node => [node.id, node]))
    next.summaries = ranges.map(({ summary, ids }) => {
      const parent = resolve(summary.parent), targets = new Set(ids.map(resolve))
      const indices = (after.get(parent)?.children || []).flatMap((node, index) => targets.has(node.id) ? [index] : [])
      return { ...summary, parent, ...(indices.length ? { start: Math.min(...indices), end: Math.max(...indices) } : {}) }
    })
  }
  return { data: next, changed: true }
}
