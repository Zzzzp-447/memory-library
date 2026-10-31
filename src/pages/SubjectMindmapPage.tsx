import { useEffect, useRef, useState } from 'react'
import type { MindElixirInstance, NodeObj } from 'mind-elixir'
import { MindMap, MindMapControls, type MindMapRef } from '@/components/ui/mindmap'
import { PaperIcon } from '@/components/ui/paper-icon'
import { TextbookDialog } from '@/components/TextbookDialog'
import { loadLibrary, saveLibrary, type Subject, type Library } from '@/lib/study-library'
import { isAccumulation, loadSubjectMap, saveSubjectMap, outlineToMap, type SavedMap } from '@/lib/subject-mindmap'
import { profileKey } from '@/lib/cloud-session'
import { cloudMapVersions } from '@/lib/cloud-sync'
import { SyncIndicator } from '@/components/AccountPage'
import { removeGeneratedFoundation } from '@/lib/foundation-knowledge'
import { mapNodes, readMapImage, nodeImage, setNodeImage, normalizeMapImages } from '@/lib/map-images'
import { attachCards, type CardNodeMeta } from '@/lib/card-mindmap'
import { deduplicateMap } from '@/lib/deduplicate-map'
import { CardReview } from '@/components/CardReview'
import { recordReview, type ReviewResult } from '@/lib/review-schedule'
import { syncReminderCards } from '@/lib/reminders'
import '@/study-app.css'

type Arrow = MindElixirInstance['arrows'][number]

export default function SubjectMindmapPage() {
  const [library, setLibrary] = useState<Library | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    const refresh = () => { void loadLibrary().then(library => { if (active) { setLibrary(library); setError('') } }).catch(() => { if (active) setError('学科资料读取失败，请保留应用数据并重试。') }) }
    refresh(); window.addEventListener('memory-cloud-change', refresh)
    return () => { active = false; window.removeEventListener('memory-cloud-change', refresh) }
  }, [])
  const id = new URLSearchParams(window.location.search).get('subject')
  const subjects = library?.subjects
  const subject = subjects?.find(item => item.id === id) || (!id ? subjects?.[0] : undefined)
  if (!subject) return <main className="notebook-preview"><SyncIndicator /><a href="/">返回学科收纳</a><p role="status">{error || (subjects ? '没有找到这个学科，请返回主页选择。' : '正在打开学科导图…')}</p></main>
  return <SubjectMap key={subject.id} subject={subject} subjects={subjects!} library={library!} onLibraryChange={setLibrary} />
}

function SubjectMap({ subject, subjects, library, onLibraryChange }: { subject: Subject; subjects: Subject[]; library: Library; onLibraryChange: (library: Library) => void }) {
  const [profile] = useState(profileKey)
  const [loaded] = useState(() => {
    try { return { saved: loadSubjectMap(subject), error: '' } }
    catch (error) { return { saved: null, error: (error as Error).message } }
  })
  const [saved, setSaved] = useState<SavedMap | null>(loaded.saved)
  const [selected, setSelected] = useState<NodeObj[]>([])
  const [linkingFrom, setLinkingFrom] = useState<NodeObj | null>(null)
  const [selectedArrow, setSelectedArrow] = useState<Arrow | null>(null)
  const [status, setStatus] = useState(loaded.error)
  const [revision, setRevision] = useState(0)
  const ref = useRef<MindMapRef>(null)
  const detail = useRef<HTMLDialogElement>(null)
  const imageInput = useRef<HTMLInputElement>(null), imagePreview = useRef<HTMLDialogElement>(null)
  const imageTarget = useRef('')
  const [imageBusy, setImageBusy] = useState(false)
  const cardDialog = useRef<HTMLDialogElement>(null), answering = useRef(false)
  const [activeCardId, setActiveCardId] = useState<string | null>(null)
  const [reviewBusy, setReviewBusy] = useState(false)
  const [reviewError, setReviewError] = useState('')
  const activeCard = library.cards.find(card => card.id === activeCardId && card.subjectId === subject.id)
  const version = useRef(loaded.saved?.cloudVersion)
  const writes = useRef(0), historyView = useRef(false), queue = useRef<Promise<unknown>>(Promise.resolve())
  const [versions, setVersions] = useState(() => cloudMapVersions(subject.id))
  useEffect(() => {
    const refresh = () => {
      if (profileKey() !== profile) return
      const next = cloudMapVersions(subject.id); setVersions(next)
      if (writes.current || historyView.current) return
      const current = next.find(item => item.id === version.current && item.head) || next.find(item => item.head)
      if (current && current.id !== version.current) { version.current = current.id; setSaved({ ...structuredClone(current.value), cloudVersion: current.id }); setSelected([]); setLinkingFrom(null); setSelectedArrow(null); setRevision(value => value + 1) }
    }
    window.addEventListener('memory-cloud-change', refresh)
    return () => window.removeEventListener('memory-cloud-change', refresh)
  }, [subject.id, profile])
  const persist = (next: SavedMap): Promise<boolean> => {
    const snapshot = JSON.parse(JSON.stringify(next)) as SavedMap
    writes.current++
    const save = queue.current.catch(() => {}).then(async () => {
      try {
        const stored = await saveSubjectMap(subject.id, snapshot, version.current, profile)
        version.current = stored.cloudVersion; historyView.current = false
        setSaved(stored); setVersions(cloudMapVersions(subject.id)); setStatus(''); return true
      } catch (error) { setStatus(`保存失败：${(error as Error).message} 请导出保留当前修改。`); return false }
      finally { writes.current-- }
    })
    queue.current = save
    return save
  }
  useEffect(() => {
    if (!saved || writes.current || historyView.current) return
    const normalized = normalizeMapImages(saved.data)
    const cleaned = removeGeneratedFoundation(normalized.data)
    const deduplicated = deduplicateMap(cleaned.data)
    const result = attachCards(deduplicated.data, subject, library.cards)
    if (!result.changed && !normalized.changed && !cleaned.changed && !deduplicated.changed) return
    void persist({ ...saved, data: result.data }).then(ok => {
      if (ok) { setSelected([]); setLinkingFrom(null); setSelectedArrow(null); setRevision(value => value + 1) }
    })
  }, [saved, subject, library.cards])
  const answerCard = async (result: ReviewResult) => {
    if (!activeCardId || answering.current) return
    answering.current = true; setReviewBusy(true); setReviewError('')
    try {
      const current = await loadLibrary(profile), card = current.cards.find(item => item.id === activeCardId && item.subjectId === subject.id)
      if (!card) throw new Error('卡片未找到，请完成同步后重试。')
      const stored = await saveLibrary({ ...current, cards: current.cards.map(item => item.id === card.id ? recordReview(item, result, Date.now()) : item) }, current, profile)
      onLibraryChange(stored); syncReminderCards(stored.cards, stored.reviewGoal || 6)
      navigator.vibrate?.(20); cardDialog.current?.close(); setActiveCardId(null)
    } catch (error) { setReviewError((error as Error).message) }
    finally { answering.current = false; setReviewBusy(false) }
  }
  const selectedElement = () => selected[0] && ref.current?.instance?.findEle(selected[0].id)
  const selectNodes = (nodes: NodeObj[]) => {
    setSelected(nodes)
    if (!linkingFrom || nodes.length !== 1 || nodes[0].id === linkingFrom.id) return
    const mind = ref.current?.instance, to = nodes[0]
    const fromElement = mind?.findEle(linkingFrom.id), toElement = mind?.findEle(to.id)
    if (!mind || !fromElement || !toElement) { setLinkingFrom(null); return }
    setLinkingFrom(null)
    const existing = mind.arrows.find(arrow => (arrow.from === linkingFrom.id && arrow.to === to.id) || (arrow.from === to.id && arrow.to === linkingFrom.id))
    if (existing) { const group = mind.arrowSvg.querySelector(`[data-linkid="${CSS.escape(existing.id)}"]`); if (group) mind.selectArrow(group as typeof mind.currentArrow & Element); return }
    const a = fromElement.getBoundingClientRect(), b = toElement.getBoundingClientRect()
    const dx = (b.x + b.width / 2 - a.x - a.width / 2) / mind.scaleVal, dy = (b.y + b.height / 2 - a.y - a.height / 2) / mind.scaleVal
    const distance = Math.max(1, Math.hypot(dx, dy)), bend = Math.max(80, Math.min(180, distance * .25))
    const nx = -dy / distance * bend, ny = dx / distance * bend
    mind.createArrowFrom({ from: linkingFrom.id, to: to.id, label: '', metadata: { kind: 'knowledge-relation' }, style: { stroke: '#B7D1EA', strokeWidth: 2.5, strokeDasharray: 'none' },
      delta1: { x: Math.round(dx * .28 + nx), y: Math.round(dy * .28 + ny) }, delta2: { x: Math.round(-dx * .28 + nx), y: Math.round(-dy * .28 + ny) } })
  }
  return <main className="notebook-preview">
    <SyncIndicator />
    <header className="notebook-preview-header">
      <div className="mindmap-page-title"><a href={`/subjects/${encodeURIComponent(subject.id)}`} aria-label="返回学科章节"><PaperIcon name="arrow-left" /></a><h1>Mind Map</h1></div>
      <label className="map-subject-picker">学科<select aria-label="导图所属学科" value={subject.id} onChange={event => { window.location.href = `/mindmap-style?subject=${encodeURIComponent(event.target.value)}` }}>{subjects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      {saved && <div className="notebook-preview-actions" aria-label="导图编辑">
        {!isAccumulation(subject) && <TextbookDialog subjectName={subject.name} onGenerate={async (text, source) => {
          try {
            const outline = outlineToMap(subject, source.title, text)
            const textbook = outline.nodeData
            textbook.id = crypto.randomUUID()
            const data = ref.current?.instance?.getData() || saved.data
            const children = [...(data.nodeData.children || []), { ...textbook, direction: ((data.nodeData.children?.length || 0) % 2) as 0 | 1 }]
            if (!await persist({ data: deduplicateMap({ ...data, nodeData: { ...data.nodeData, children } }).data, source })) return false
            setSelected([]); setLinkingFrom(null); setSelectedArrow(null); setRevision(value => value + 1); return true
          } catch (error) { setStatus((error as Error).message); return false }
        }} />}
        {selected[0]?.note && <button onClick={() => detail.current?.showModal()}><PaperIcon name="layers" />节点说明</button>}
        <button disabled={selected.length !== 1 || imageBusy} onClick={() => { imageTarget.current = selected[0].id; imageInput.current?.click() }}><PaperIcon name="image" />{imageBusy ? '正在处理…' : selected[0]?.image ? '替换图片' : '插入图片'}</button>
        {selected[0]?.image && <>
          <button onClick={() => imagePreview.current?.showModal()}><PaperIcon name="image" />查看图片</button>
          <button disabled={imageBusy} onClick={async () => {
            const data = ref.current?.instance?.getData()
            const node = data && mapNodes(data).find(item => item.id === selected[0].id)
            if (!node || !data) return
            setNodeImage(node)
            if (await persist({ ...saved, data })) { setSelected([]); setSelectedArrow(null); setLinkingFrom(null); setRevision(value => value + 1) }
          }}><PaperIcon name="trash" />移除图片</button>
        </>}
        <button disabled={!selected.length} onClick={() => { const element = selectedElement(); if (element) ref.current?.instance?.addChild(element, { id: crypto.randomUUID(), topic: '新的知识点' }) }}><PaperIcon name="plus" />添加分支</button>
        <button className="relation-button" disabled={selected.length !== 1 || !!linkingFrom} onClick={() => { setLinkingFrom(selected[0]); ref.current?.instance?.unselectArrow(); setSelectedArrow(null) }}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 18 C4 3 19 3 21 18" /><circle cx="3" cy="18" r="1.5"/><circle cx="21" cy="18" r="1.5"/></svg>关联曲线</button>
        {linkingFrom && <button onClick={() => setLinkingFrom(null)}><PaperIcon name="x" />取消连接</button>}
        <button disabled={!selectedArrow} onClick={() => { ref.current?.instance?.removeArrow(); setSelectedArrow(null) }}><PaperIcon name="trash" />删除连线</button>
        <button disabled={!selected.length} onClick={() => { const element = selectedElement(); if (element) ref.current?.instance?.beginEdit(element) }}><PaperIcon name="pencil" />改文字</button>
        <button disabled={!selected.length || selected.some(node => node.id === saved.data.nodeData.id)} onClick={() => {
          const mind = ref.current?.instance, element = selectedElement()
          if (element && mind) { mind.removeNodes([element]); setSelected(mind.currentNode ? [mind.currentNode.nodeObj] : []) }
        }}><PaperIcon name="trash" />删分支</button>
        <button onClick={() => {
          const current = ref.current?.instance?.getData()
          if (!current) return
          const json = JSON.stringify(current, null, 2)
          const nativeExport = (window as Window & { MemoryExport?: { save: (text: string) => void } }).MemoryExport
          if (nativeExport) { nativeExport.save(json); return }
          const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
          const link = document.createElement('a'); link.href = url; link.download = `${subject.name}-知识地图.json`; link.click()
          setTimeout(() => URL.revokeObjectURL(url), 1000)
        }}><PaperIcon name="download" />导出</button>
      </div>}
    </header>
    {versions.length > 1 && <label className="map-history">{versions.filter(item => item.head).length > 1 ? '存在并发版本，所有版本均已保留' : '导图历史版本'}<select aria-label="导图保存版本" value={saved?.cloudVersion || ''} onChange={event => {
      const chosen = versions.find(item => item.id === event.target.value)
      if (chosen) { version.current = chosen.id; historyView.current = !chosen.head; setSaved({ ...structuredClone(chosen.value), cloudVersion: chosen.id }); setSelected([]); setLinkingFrom(null); setSelectedArrow(null); setRevision(value => value + 1) }
    }}>{versions.map(item => <option key={item.id} value={item.id}>{item.head ? '分支' : '历史'} · {item.device} · {new Date(item.at).toLocaleString('zh-CN')}</option>)}</select></label>}
    {isAccumulation(subject) && <p className="map-hint">自由绘制：选择知识点后添加分支，按自己的积累整理。</p>}
    {saved?.source && <p className="map-hint">教材：{saved.source.title}{saved.source.edition ? ` · ${saved.source.edition}` : ''}</p>}
    {linkingFrom && <p className="relation-hint" role="status">已选“{linkingFrom.topic}”，请点击另一个知识点。</p>}
    {status && <p className="notebook-preview-status" role="alert">{status}</p>}
    <input hidden ref={imageInput} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,image/heic,image/heif" aria-label="导图节点图片" onChange={async event => {
      const file = event.target.files?.[0], target = imageTarget.current
      event.target.value = ''
      if (!file || imageBusy) return
      setImageBusy(true)
      try {
        const image = await readMapImage(file)
        const data = ref.current?.instance?.getData()
        const node = data && mapNodes(data).find(item => item.id === target)
        if (!node || !data || !saved) throw new Error('原节点已不存在，请重新选择节点。')
        setNodeImage(node, image)
        if (await persist({ ...saved, data })) { setSelected([]); setSelectedArrow(null); setLinkingFrom(null); setRevision(value => value + 1) }
      } catch (error) { setStatus((error as Error).message) }
      finally { setImageBusy(false) }
    }} />
    <dialog ref={imagePreview} className="textbook-dialog foundation-dialog" aria-label="节点图片预览">
      <div className="textbook-heading"><h2>{selected[0]?.topic}</h2><button aria-label="关闭图片预览" onClick={() => imagePreview.current?.close()}><PaperIcon name="x" /></button></div>
      {nodeImage(selected[0]) && <img src={nodeImage(selected[0])!.url} alt={selected[0]?.topic} style={{ width: '100%', height: 'auto' }} />}
    </dialog>
    <dialog ref={detail} className="textbook-dialog foundation-dialog" aria-label="节点说明">
      <div className="textbook-heading"><h2>{selected[0]?.topic}</h2><button aria-label="关闭节点说明" onClick={() => detail.current?.close()}><PaperIcon name="x" /></button></div>
      <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.9 }}>{selected[0]?.note}</p>
      <button onClick={() => detail.current?.close()}>返回导图</button>
    </dialog>
    <dialog ref={cardDialog} className="study-dialog review-dialog map-card-dialog" aria-label="导图题目卡片" onClose={() => setActiveCardId(null)}>
      <div className="dialog-heading"><span>{activeCard ? subject.chapters.find(chapter => chapter.id === activeCard.chapterId)?.name : '题目卡片'}</span><button className="icon-button" aria-label="关闭题目卡片" disabled={reviewBusy} onClick={() => cardDialog.current?.close()}><PaperIcon name="x" /></button></div>
      {activeCard ? <CardReview key={activeCard.id} card={activeCard} busy={reviewBusy} onAnswer={answerCard} /> : <p role="status">卡片尚未同步到本机，请联网同步后重试。</p>}
      {reviewError && <p className="inline-warning" role="alert">{reviewError}</p>}
    </dialog>
    {saved && <section className="notebook-preview-board" aria-label={`${subject.name}知识地图`}>
      <MindMap key={revision} ref={ref} data={saved.data} theme="light" locale="zh_CN" onChange={data => { void persist({ ...saved, data }) }} onSelectNodes={selectNodes} onSelectArrow={setSelectedArrow} onOpenImage={node => { setSelected([node]); imagePreview.current?.showModal() }} onOpenCard={node => { setReviewError(''); setActiveCardId((node.metadata as CardNodeMeta).cardId || null); cardDialog.current?.showModal() }}><MindMapControls showExport={false} /></MindMap>
    </section>}
  </main>
}
