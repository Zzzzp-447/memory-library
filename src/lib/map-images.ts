import type { MindElixirData, NodeObj } from 'mind-elixir'
export const mapAssetPrefix = 'memory-asset:'
export function mapNodes(data: MindElixirData): NodeObj[] {
  const nodes: NodeObj[] = [], stack = [data.nodeData]
  while (stack.length) { const node = stack.pop()!; nodes.push(node); stack.push(...(node.children || [])) }
  return nodes
}
export const mapAssetHash = (url?: string) => /^memory-asset:([a-f0-9]{64})$/.exec(url || '')?.[1]
type Image = NonNullable<NodeObj['image']>
export const nodeImage = (node?: NodeObj): Image | undefined => (node?.metadata as { imageAttachment?: Image } | undefined)?.imageAttachment || node?.image
export const mapImages = (data: MindElixirData): Image[] => mapNodes(data).flatMap(node => {
  const attachment = (node.metadata as { imageAttachment?: Image } | undefined)?.imageAttachment
  return [...(node.image ? [node.image] : []), ...(attachment ? [attachment] : [])]
})
export const mapAssetHashes = (data: MindElixirData) => [...new Set(mapImages(data).flatMap(image => mapAssetHash(image.url) || []))]
export function setNodeImage(node: NodeObj, image?: Image) {
  const meta = { ...(node.metadata as object) } as Record<string, unknown>
  if (image) { meta.imageAttachment = image; node.image = { url: '/paper/icons/image.svg', width: 44, height: 44, fit: 'contain' } }
  else { delete meta.imageAttachment; delete node.image }
  node.metadata = meta
}
export function normalizeMapImages(data: MindElixirData) {
  const next = structuredClone(data)
  for (const node of mapNodes(next)) if (node.image && !(node.metadata as { imageAttachment?: Image } | undefined)?.imageAttachment) setNodeImage(node, node.image)
  return { data: next, changed: JSON.stringify(next) !== JSON.stringify(data) }
}

export async function readMapImage(file: File): Promise<NonNullable<NodeObj['image']>> {
  if (file.size > 20 * 1024 * 1024 || !(/^image\/(jpeg|png|webp|gif|bmp|heic|heif)$/.test(file.type) || /\.hei[cf]$/i.test(file.name))) throw new Error('请选择 20 MB 以内的图片文件。')
  const url = URL.createObjectURL(file)
  try {
    const image = new Image(); image.src = url
    try { await image.decode() } catch { throw new Error('无法读取图片，请换用 JPG 或 PNG 格式。') }
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d'); if (!context) throw new Error('图片处理失败，请重试。')
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const display = Math.min(1, 260 / Math.max(canvas.width, canvas.height))
    return { url: canvas.toDataURL('image/jpeg', .9), width: Math.round(canvas.width * display), height: Math.round(canvas.height * display), fit: 'contain' }
  } finally { URL.revokeObjectURL(url) }
}
