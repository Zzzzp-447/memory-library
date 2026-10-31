import { useRef, useState, type FormEvent } from 'react'
import { searchTextbooks, readBookOutline, type BookResult, type MapSource } from '@/lib/subject-mindmap'
import { PaperIcon } from './ui/paper-icon'

export function TextbookDialog({ subjectName, onGenerate }: { subjectName: string; onGenerate: (text: string, source: MapSource) => Promise<boolean> }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [provider, setProvider] = useState<'china' | 'openlibrary'>('china')
  const [selected, setSelected] = useState<BookResult | null>(null)
  const [query, setQuery] = useState(subjectName)
  const [results, setResults] = useState<BookResult[]>([])
  const [title, setTitle] = useState('')
  const [outline, setOutline] = useState('')
  const [source, setSource] = useState<MapSource | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const resolvedTitle = title.trim() || query.trim() || subjectName
  const search = async (event: FormEvent) => {
    event.preventDefault()
    if (!query.trim() || busy) return
    setBusy(true); setMessage(''); setResults([]); setSelected(null); setTitle(''); setSource(null); setOutline('')
    try { const books = await searchTextbooks(query.trim(), provider); setResults(books); if (!books.length) setMessage('未找到书目。可尝试书名、作者或 ISBN，也可以直接粘贴目录。') }
    catch (error) { setMessage((error as Error).message) }
    finally { setBusy(false) }
  }
  return <>
    <button onClick={() => dialog.current?.showModal()}><PaperIcon name="search" />搜索教材，生成导图</button>
    <dialog ref={dialog} className="textbook-dialog" aria-label="搜索教材生成导图">
      <div className="textbook-heading"><h2>Textbook Outline</h2><button aria-label="关闭教材搜索" onClick={() => dialog.current?.close()}><PaperIcon name="x" /></button></div>
      <form onSubmit={search} className="textbook-search"><label>教材书名、作者或 ISBN<input value={query} maxLength={200} onChange={event => setQuery(event.target.value)} required /></label><button disabled={busy}>{busy ? '正在读取…' : '搜索公开书目'}</button></form>
      <label>教材来源<select value={provider} disabled={busy} onChange={event => { setProvider(event.target.value as 'china' | 'openlibrary'); setResults([]); setMessage('') }}><option value="china">ChinaTextbook 教材知识库</option><option value="openlibrary">Open Library 补充书目</option></select></label>
      <p className="textbook-hint">优先展示已核验目录。其他教材依次读取 PDF 书签和目录页文字；纯扫描版未核验时可粘贴目录。</p>
      <div className="textbook-results">{results.map(book => <button key={book.key} disabled={busy} onClick={async () => {
        setBusy(true); setSelected(book); setMessage(book.source === 'china' && !book.verified ? '正在下载教材并读取目录，可能需要一些时间…' : ''); setTitle(book.title); setSource(null); setOutline('')
        try { const found = await readBookOutline(book); setTitle(found.source.title); setSource(found.source); setOutline(found.text); setMessage(found.text.trim() ? '' : '没有读取到可用目录：此版本可能是纯扫描件，或目录不在可读取的前32页内。请打开教材来源核对并粘贴目录，或选择已核验版本。') }
        catch (error) { setMessage((error as Error).message) }
        finally { setBusy(false) }
      }}><strong>{book.title}</strong><span>{book.author}{book.year ? ` · ${book.year}` : ''}</span><small>{book.source === 'china' ? `${book.verified ? '已核验目录' : '尝试读取PDF目录'} · ${((book.size || 0) / 1048576).toFixed(1)}MB${book.kind === 'supplement' ? ' · 辅导资料' : ''}` : '读取公开目录'}</small></button>)}</div>
      {selected?.source === 'china' && <p className="textbook-hint"><a href={`https://github.com/TapXWorld/ChinaTextbook/tree/master/${selected.path?.split('/').map(encodeURIComponent).join('/')}`} target="_blank" rel="noreferrer">查看教材来源</a></p>}
      {message && <p className="textbook-message" role="status">{message}</p>}
      {source && <p className="textbook-hint">目录版本：{source.edition || source.title}</p>}
      <label>目录预览 / 粘贴目录<textarea value={outline} maxLength={40000} rows={8} onChange={event => setOutline(event.target.value)} placeholder={'每行一个章节，缩进表示下级知识点。例如：\n第一章 运动学\n  位移与速度\n  加速度'} /></label>
      <button disabled={busy || !outline.trim()} onClick={async () => { setBusy(true); try { if (await onGenerate(outline, { ...source, title: resolvedTitle })) dialog.current?.close(); else setMessage('目录未能保存，请保留内容并检查保存提示。') } finally { setBusy(false) } }}><PaperIcon name="layers" />生成并加入当前导图</button>
    </dialog>
  </>
}
