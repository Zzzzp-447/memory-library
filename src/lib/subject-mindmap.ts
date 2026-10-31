import { searchChinaBooks, readChinaOutline } from './china-textbooks'
import type { MindElixirData } from 'mind-elixir'
import type { Subject } from './study-library'
import { profileKey } from './cloud-session'
import { cloudMapVersions, saveCloudMap } from './cloud-sync'

export interface MapSource { title: string; url?: string; edition?: string }
export interface SavedMap { data: MindElixirData; source?: MapSource; cloudVersion?: string }
export const mapKey = (id: string) => `mistake-cards:subject-mindmap:v1:${id}`
export const isAccumulation = (subject: Subject) => subject.id === 'english' || /英语|外语|日语|词汇|积累|english/i.test(subject.name)

export function loadSubjectMap(subject: Subject): SavedMap {
  if (profileKey() === 'guest') return loadGuestMap(subject)
  const version = cloudMapVersions(subject.id).find(version => version.head)
  return version ? { ...structuredClone(version.value), cloudVersion: version.id } : { data: { nodeData: { id: `subject-${subject.id}`, topic: subject.name } } }
}
export async function saveSubjectMap(subjectId: string, value: SavedMap, parent: string | undefined, profile: string): Promise<SavedMap> {
  if (profile !== profileKey()) throw new Error('账号已切换，请刷新后再编辑。')
  const { cloudVersion: _version, ...content } = value; void _version
  if (profile === 'guest') { localStorage.setItem(mapKey(subjectId), JSON.stringify(content)); return content }
  const version = await saveCloudMap(subjectId, content, parent, profile)
  return { ...content, cloudVersion: version }
}
export function loadGuestMap(subject: Subject): SavedMap {
  const raw = localStorage.getItem(mapKey(subject.id))
  if (raw) {
    const saved = JSON.parse(raw) as SavedMap
    if (!saved.data?.nodeData?.id || typeof saved.data.nodeData.topic !== 'string') throw new Error('导图数据无法读取，请先保留应用数据。')
    return saved
  }
  // The old shared sample belongs only to math. Never copy it to other subjects.
  const legacy = subject.id === 'math' && localStorage.getItem('mistake-cards:paper-mindmap-preview:v1')
  if (legacy) {
    const data = JSON.parse(legacy) as MindElixirData
    if (data.nodeData?.id && typeof data.nodeData.topic === 'string') return { data }
    throw new Error('原高数导图无法读取，请先保留应用数据。')
  }
  return { data: { nodeData: { id: `subject-${subject.id}`, topic: subject.name } } }
}

export interface BookResult { key: string; title: string; author: string; year?: number; source?: 'china'; path?: string; size?: number; verified?: boolean; kind?: string }
async function publicJson(url: string): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error('公开书目服务暂不可用，请稍后重试或粘贴教材目录。')
    return await response.json()
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('公开书目')) throw error
    throw new Error('未能连接公开书目服务。可稍后重试，或粘贴教材目录生成。')
  } finally { clearTimeout(timer) }
}

export async function searchTextbooks(query: string, provider: 'china' | 'openlibrary' = 'china'): Promise<BookResult[]> {
  if (provider === 'china') return (await searchChinaBooks(query)).map(book => ({ key: book.id, title: book.title, author: `${book.category} / ${book.subject}`, source: 'china', path: book.path, size: book.size, verified: !!book.outline, kind: book.kind }))
  const params = new URLSearchParams({ q: query, limit: '10', fields: 'key,title,author_name,first_publish_year' })
  const result = await publicJson(`https://openlibrary.org/search.json?${params}`) as { docs?: { key?: string; title?: string; author_name?: string[]; first_publish_year?: number; source?: 'china'; path?: string; size?: number; verified?: boolean; kind?: string }[] }
  if (!Array.isArray(result.docs)) throw new Error('书目返回格式异常，请稍后重试。')
  return result.docs.filter(book => /^\/works\/OL\d+W$/.test(book.key || '') && typeof book.title === 'string').map(book => ({
    key: book.key!, title: book.title!.slice(0, 200), author: (book.author_name || []).slice(0, 3).join(' / '), year: book.first_publish_year,
  }))
}

export async function readBookOutline(book: BookResult): Promise<{ text: string; source: MapSource }> {
  if (book.source === 'china') return readChinaOutline(book.key)
  if (!/^\/works\/OL\d+W$/.test(book.key)) throw new Error('教材编号无效。')
  const result = await publicJson(`https://openlibrary.org${book.key}/editions.json?limit=20`) as { entries?: { title?: string; publish_date?: string; publishers?: string[]; key?: string; table_of_contents?: { title?: string; level?: number }[] }[] }
  const edition = result.entries?.find(entry => Array.isArray(entry.table_of_contents) && entry.table_of_contents.some(row => row.title?.trim()))
  if (!edition) return { text: '', source: { title: book.title, url: `https://openlibrary.org${book.key}` } }
  const rows = edition.table_of_contents!.filter(row => row.title?.trim()).slice(0, 200)
  const base = Math.min(...rows.map(row => Number(row.level) || 0))
  return { text: rows.map(row => `${'  '.repeat(Math.min(3, Math.max(0, (Number(row.level) || 0) - base)))}${row.title!.trim().slice(0, 200)}`).join('\n'),
    source: { title: edition.title || book.title, url: /^\/books\/OL\d+M$/.test(edition.key || '') ? `https://openlibrary.org${edition.key}` : `https://openlibrary.org${book.key}`, edition: [edition.publish_date, ...(edition.publishers || [])].filter(Boolean).join(' · ') } }
}

export function outlineToMap(subject: Subject, title: string, text: string): MindElixirData {
  const lines = text.split(/\r?\n/).filter(line => line.trim())
  if (!lines.length || lines.length > 200) throw new Error('请输入 1–200 行目录。')
  type Branch = { id: string; topic: string; children: Branch[]; direction?: 0 | 1 }
  const root: Branch = { id: `subject-${subject.id}`, topic: title.trim() || subject.name, children: [] }
  const stack: { indent: number; node: Branch }[] = [{ indent: -1, node: root }]
  for (const line of lines) {
    const indent = line.match(/^\s*/)?.[0].replace(/\t/g, '  ').length || 0
    const topic = line.trim().replace(/^[-*•]\s+/, '').slice(0, 200)
    const node: Branch = { id: crypto.randomUUID(), topic, children: [] }
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop()
    stack[stack.length - 1].node.children.push(node)
    if (stack.length === 1) node.direction = (root.children.length % 2) as 0 | 1
    stack.push({ indent, node })
  }
  return { nodeData: root }
}
