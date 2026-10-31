import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Route, Switch, useLocation } from 'wouter'
import { PaperIcon } from './components/ui/paper-icon'
import { MaskEditor, type CardImages } from './components/MaskEditor'
import { CardReview } from './components/CardReview'
import { TodayReview } from './components/TodayReview'
import { defaultReviewGoal, recordReview } from './lib/review-schedule'
import { syncReminderCards } from './lib/reminders'
import { AccountPage, SyncIndicator } from './components/AccountPage'
import { InstallPage } from './components/InstallPage'
import { profileKey } from './lib/cloud-session'
import { loadLibrary, saveLibrary, type Library, type PaperColor, type StudyCard } from './lib/study-library'
import './components/ui/paper-mindmap.css'
import './study-app.css'

type Persist = (next: Library) => Promise<boolean>
interface PageProps { library: Library; persist: Persist; busy: boolean }
const colors: PaperColor[] = ['blue', 'yellow', 'cream', 'red']
const colorLabels = ['浅蓝', '浅黄', '奶油白', '红色']

function AddDialog({ mode, onSubmit }: { mode: 'subject' | 'chapter'; onSubmit: (name: string, color: PaperColor, face: number) => Promise<boolean> }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [busy, setBusy] = useState(false)
  return <>
    <button className={mode === 'subject' ? 'folder-add' : 'paper-button'} onClick={() => ref.current?.showModal()}>
      <PaperIcon name="plus" />{mode === 'subject' ? <span>添加学科</span> : '添加章节'}
    </button>
    <dialog ref={ref} className="study-dialog" onClick={event => { if (event.target === event.currentTarget && !busy) ref.current?.close() }}>
      <form onSubmit={async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        const form = event.currentTarget
        const fields = new FormData(form)
        const name = String(fields.get('name') || '').trim()
        if (!name || busy) return
        setBusy(true)
        try {
          if (await onSubmit(name, (fields.get('color') || 'blue') as PaperColor, Number(fields.get('face') || 0))) {
            form.reset(); ref.current?.close()
          }
        } finally { setBusy(false) }
      }}>
        <div className="dialog-heading"><h2>{mode === 'subject' ? 'New Subject' : 'New Chapter'}</h2><button type="button" className="icon-button" aria-label="关闭" onClick={() => ref.current?.close()}><PaperIcon name="x" /></button></div>
        <label>{mode === 'subject' ? '学科名称' : '章节名称'}<input name="name" placeholder={mode === 'subject' ? '例如：线性代数' : '例如：多元函数微分学'} required maxLength={32} autoComplete="off" /></label>
        {mode === 'subject' && <>
          <fieldset><legend>文件夹颜色</legend><div className="color-picker">{colors.map((color, index) => <label key={color} className={`color-choice tone-${color}`}><input type="radio" name="color" value={color} defaultChecked={index === 0} /><span>{colorLabels[index]}</span></label>)}</div></fieldset>

        </>}
        <button className="paper-button primary" disabled={busy} type="submit"><PaperIcon name="check" />{busy ? '正在保存…' : '收进资料库'}</button>
      </form>
    </dialog>
  </>
}

function Home({ library, persist }: PageProps) {
  return <>
    <section className="study-intro">
      <h1>My Library</h1>
    </section>
    <section className="subject-section">
      <div className="section-heading"><h2>Subjects</h2><span className="library-count">{library.subjects.length} 个学科 · {library.cards.length} 张卡片</span></div>
      <div className="folder-grid">{library.subjects.map((subject, index) => {
        const cards = library.cards.filter(card => card.subjectId === subject.id)
        return <Link key={subject.id} href={`/subjects/${subject.id}`} className={`subject-folder tone-${subject.color}`} aria-label={`打开${subject.name}`}>
          <div className="folder-object" style={{ '--folder-tilt': `${index % 2 === 0 ? -2 : 1.5}deg` } as React.CSSProperties}>
            <svg className="folder-tab" viewBox="0 0 320 260" preserveAspectRatio="none" aria-hidden="true"><path d="M13 244 Q8 244 8 233 L8 25 Q8 6 27 6 L105 7 Q117 7 123 18 L136 38 Q141 47 155 47 L298 48 Q313 48 313 65 L312 235 Q312 250 296 250 Z" /></svg>
            <span className="folder-paper" aria-hidden="true" />
            <div className="folder-cover" aria-hidden="true"><div className="folder-cover-lines"><span /><span /></div><div className="folder-binding"><i /><i /><i /></div></div>
          </div>
          <div className="folder-caption"><div><h3>{subject.name}</h3><span>{subject.chapters.length} 个章节 · {cards.length} 张卡片</span></div><PaperIcon name="arrow-right" /></div>
        </Link>
      })}<AddDialog mode="subject" onSubmit={async (name, color, face) => persist({ ...library, subjects: [...library.subjects, { id: crypto.randomUUID(), name, color, face, chapters: [] }] })} /></div>
    </section>

  </>
}

function SubjectPage({ library, persist, subjectId }: PageProps & { subjectId: string }) {
  const subject = library.subjects.find(item => item.id === subjectId)
  if (!subject) return <Empty title="Subject Not Found" text="回到资料库，选一个文件夹吧。" href="/library" action="回到学科收纳" />
  return <>
    <Link href="/library" className="back-link"><PaperIcon name="arrow-left" />学科收纳</Link>
    <header className="chapter-heading"><div><h1>Chapters</h1></div><AddDialog mode="chapter" onSubmit={async name => persist({ ...library, subjects: library.subjects.map(item => item.id === subjectId ? { ...item, chapters: [...item.chapters, { id: crypto.randomUUID(), name }] } : item) })} /></header>
    <div className="chapter-grid">{subject.chapters.map((chapter, index) => <Link key={chapter.id} href={`/subjects/${subject.id}/chapters/${chapter.id}`} className={`chapter-paper tone-${colors[index % 3]}`} style={{ '--card-tilt': `${[-1.3, 1.1, -.6, 1.6][index % 4]}deg` } as React.CSSProperties}>
      <span className={index % 3 === 0 ? 'paper-pin' : 'tape'} /><span className="chapter-number">CHAPTER {String(index + 1).padStart(2, '0')}</span><h2>{chapter.name}</h2><span className="chapter-bottom">{library.cards.filter(card => card.chapterId === chapter.id && card.subjectId === subject.id).length} 张记忆卡片<PaperIcon name="arrow-right" /></span>
    </Link>)}</div>
    {!subject.chapters.length && <Empty title="No Chapters Yet" text="点击上方“添加章节”，给知识搭一个小框架。" />}
    <div className="chapter-page-bottom"><Link className="paper-button primary" href={`/create?subject=${subject.id}`}><PaperIcon name="plus" />为这个学科制卡</Link><a className="paper-button" href={`/mindmap-style?subject=${encodeURIComponent(subject.id)}`}><PaperIcon name="layers" />{subject.id === 'english' ? '手绘导图' : '知识导图'}</a></div>
  </>
}

function Empty({ title, href, action }: { title: string; text: string; href?: string; action?: string }) {
  return <div className="study-empty"><PaperIcon name="book-open" /><h2>{title}</h2>{href && <Link href={href} className="paper-button primary">{action}<PaperIcon name="arrow-right" /></Link>}</div>
}

function ChapterPage({ library, persist, busy, subjectId, chapterId }: PageProps & { subjectId: string; chapterId: string }) {
  const subject = library.subjects.find(item => item.id === subjectId)
  const chapter = subject?.chapters.find(item => item.id === chapterId)
  const [activeCard, setActiveCard] = useState<StudyCard | null>(null)
  const review = useRef<HTMLDialogElement>(null)
  if (!subject || !chapter) return <Empty title="Chapter Not Found" text="回到资料库重新选择章节。" href="/library" action="回到学科收纳" />
  const cards = library.cards.filter(card => card.subjectId === subjectId && card.chapterId === chapterId)
  return <>
    <Link href={`/subjects/${subjectId}`} className="back-link"><PaperIcon name="arrow-left" />{subject.name}</Link>
    <header className="chapter-heading"><div><h1>Cards</h1><span className="library-count">{chapter.name} · {cards.length} 张</span></div><Link className="paper-button primary" href={`/create?subject=${subjectId}&chapter=${chapterId}`}><PaperIcon name="plus" />制作卡片</Link></header>
    {cards.length ? <div className="chapter-grid">{cards.map((card, index) => <button key={card.id} className={`chapter-paper memory-tile tone-${colors[index % 3]}`} onClick={() => { setActiveCard(card); review.current?.showModal() }}>
      <span className="tape" /><span className="chapter-number">CARD {String(index + 1).padStart(2, '0')}</span><img src={card.front} alt={`第 ${index + 1} 张题目卡片`} /><div className="tile-tags">{card.tags.map(tag => <span key={tag}>{tag}</span>)}</div><span className="chapter-bottom">点击回忆<PaperIcon name="arrow-right" /></span>
    </button>)}</div> : <Empty title="No Cards Yet" text="拍下题目，遮住答案，把它收进这个章节。" href={`/create?subject=${subjectId}&chapter=${chapterId}`} action="去制作第一张卡片" />}
    <dialog className="study-dialog review-dialog" ref={review} onClose={() => setActiveCard(null)}><div className="dialog-heading"><span>{chapter.name}</span><button className="icon-button" aria-label="关闭卡片" onClick={() => review.current?.close()}><PaperIcon name="x" /></button></div>{activeCard && <CardReview key={activeCard.id} card={activeCard} busy={busy} onAnswer={async result => {
        if (await persist({ ...library, cards: library.cards.map(card => card.id === activeCard.id ? recordReview(card, result, Date.now()) : card) })) {
          navigator.vibrate?.(20); review.current?.close()
          setActiveCard(null)
        }
      }} />}</dialog>
  </>
}

function CreatePage({ library, persist, busy }: PageProps) {
  const query = new URLSearchParams(window.location.search)
  const [subjectId, setSubjectId] = useState(query.get('subject') || library.subjects[0]?.id || '')
  const subject = library.subjects.find(item => item.id === subjectId)
  const [chapterId, setChapterId] = useState(query.get('chapter') || subject?.chapters[0]?.id || '')
  const [queue, setQueue] = useState<{ id: string; url: string; name: string; pageName?: string; region?: boolean }[]>([])
  const [index, setIndex] = useState(0)
  const [editorVersion, setEditorVersion] = useState(0)
  const [images, setImages] = useState<CardImages | null>(null)
  const [pickingRegions, setPickingRegions] = useState(true)
  const [initialRegionCount, setInitialRegionCount] = useState(1)
  const lastPickerTouch = useRef(-1000)
  const lastSaveTouch = useRef(-1000)
  const [tags, setTags] = useState('')
  const [supplementKind, setSupplementKind] = useState<'knowledge' | 'technique'>('knowledge')
  const [supplement, setSupplement] = useState('')
  const [message, setMessage] = useState('')
  const [saved, setSaved] = useState(0)
  const urls = useRef<string[]>([])
  const input = useRef<HTMLInputElement>(null)
  const [, navigate] = useLocation()
  useEffect(() => () => { urls.current.forEach(url => URL.revokeObjectURL(url)) }, [])
  const current = queue[index]
  const switchPicker = (open: boolean, touch = false) => {
    if (touch) lastPickerTouch.current = performance.now()
    else if (performance.now() - lastPickerTouch.current < 700) return
    if (open) setInitialRegionCount(2)
    setPickingRegions(open)
  }
  const save = async (sameImage: boolean) => {
    if (!images || !subject || !subject.chapters.some(chapter => chapter.id === chapterId) || busy || pickingRegions) return
    // This timestamp is captured by a save-button event, never during rendering.
    // eslint-disable-next-line react-hooks/purity
    const card: StudyCard = { id: crypto.randomUUID(), subjectId, chapterId, ...images, tags: [...new Set(tags.split(/[,，、\n]+/).map(tag => tag.trim()).filter(Boolean))], createdAt: Date.now(), correct: 0, wrong: 0, ...(supplement.trim() ? { mapSupplement: { kind: supplementKind, text: supplement.trim() } } : {}) }
    if (await persist({ ...library, cards: [...library.cards, card] })) {
      setSaved(saved + 1); setImages(null); setTags(''); setSupplement(''); setMessage('已保存')
      if (sameImage) setEditorVersion(editorVersion + 1)
      else { setIndex(index + 1); setEditorVersion(0); setInitialRegionCount(1); setPickingRegions(!queue[index + 1]?.region) }
    }
  }
  const saveByInput = (sameImage: boolean, touch = false) => {
    if (touch) lastSaveTouch.current = performance.now()
    else if (performance.now() - lastSaveTouch.current < 700) return
    void save(sameImage)
  }
  return <>
    <header className="chapter-heading creator-heading"><h1>Create Cards</h1>{saved > 0 && <span className="creator-count">已保存 {saved} 张</span>}</header>
    <div className="creator-layout"><aside className="creator-settings paper-panel">
      <h2><PaperIcon name="folder" />Collection</h2>
      <label>学科<select aria-label="本张卡片所属学科" disabled={busy} value={subjectId} onChange={event => { setSubjectId(event.target.value); setChapterId(library.subjects.find(item => item.id === event.target.value)?.chapters[0]?.id || '') }}>{library.subjects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>章节<select aria-label="本张卡片所属章节" disabled={busy} value={chapterId} onChange={event => setChapterId(event.target.value)}><option value="" disabled>选择一个章节</option>{subject?.chapters.map(chapter => <option key={chapter.id} value={chapter.id}>{chapter.name}</option>)}</select></label>
      {!subject?.chapters.length && <p className="inline-warning">先到学科文件夹里添加一个章节。<Link href={subject ? `/subjects/${subject.id}` : '/'}>去添加</Link></p>}
      <label>小标签 <span className="optional">选填</span><textarea value={tags} onChange={event => setTags(event.target.value)} placeholder="例如：换元积分，易错步骤" rows={2} maxLength={300} /></label>
      <label>补充类型<select aria-label="导图补充类型" disabled={busy} value={supplementKind} onChange={event => setSupplementKind(event.target.value as 'knowledge' | 'technique')}><option value="knowledge">知识点</option><option value="technique">解题技巧</option></select></label>
      <label>{supplementKind === 'knowledge' ? '补充知识点' : '补充解题技巧'} <span className="optional">选填</span><textarea aria-label="本张卡片的导图补充内容" disabled={busy} value={supplement} onChange={event => setSupplement(event.target.value)} maxLength={300} rows={2} placeholder={supplementKind === 'knowledge' ? '例如：夹逼准则' : '例如：先判断未定式，再选择求极限的方法'} /></label>
      <button className="paper-button" onClick={() => input.current?.click()}><PaperIcon name="image" />{queue.length ? '继续添加图片' : '选择题目图片'}</button>
      {!!queue.length && <div className="queue-list"><p>制卡队列 · {Math.min(index + 1, queue.length)} / {queue.length}</p>{queue.map((item, itemIndex) => <div key={item.id} className={itemIndex === index ? 'queue-item current' : 'queue-item'}><span>{itemIndex < index ? <PaperIcon name="check" /> : String(itemIndex + 1).padStart(2, '0')}</span><span>{item.name}</span>{itemIndex === index && <small>正在制作</small>}</div>)}</div>}
    </aside>
    <section className="creator-workspace">
      <input ref={input} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,image/heic,image/heif" multiple aria-label="批量导入题目图片" onChange={event => {
        const files = Array.from(event.target.files || [])
        const valid = files.filter(file => (/^image\/(jpeg|png|webp|gif|bmp|heic|heif)$/.test(file.type) || /\.hei[cf]$/i.test(file.name)) && file.size <= 20 * 1024 * 1024)
        const added = valid.map(file => { const url = URL.createObjectURL(file); urls.current.push(url); return { id: crypto.randomUUID(), url, name: file.name } })
        if (added.length && index >= queue.length) { setInitialRegionCount(1); setPickingRegions(true) }
        setQueue(previous => [...previous, ...added]); setMessage(valid.length < files.length ? '部分图片未添加：请使用 20 MB 以内的 JPG、PNG、WebP、GIF、BMP 或当前浏览器支持的 HEIC 图片。' : '')
        event.target.value = ''
      }} />
      {current ? <div className="maker-card paper-panel"><span className="tape" /><div className="maker-card-heading"><span>MEMORY CARD / {String(index + 1).padStart(2, '0')}</span><span>{subject?.name}</span></div>
        <div className="region-picker-heading"><span>{current.name}</span>{pickingRegions ? <button key="close-regions" type="button" className="paper-button" disabled={busy} onClick={() => switchPicker(false)} onPointerUp={event => { if (event.pointerType === 'touch' && event.isPrimary) { event.preventDefault(); switchPicker(false, true) } }}><PaperIcon name="arrow-left" />返回当前制卡</button> : <button key="open-regions" type="button" className="paper-button" disabled={busy} onClick={() => switchPicker(true)} onPointerUp={event => { if (event.pointerType === 'touch' && event.isPrimary) { event.preventDefault(); switchPicker(true, true) } }}><PaperIcon name="plus" />添加框选区域</button>}</div>
        <div hidden={pickingRegions}><MaskEditor key={`${current.id}-${editorVersion}`} source={current.url} onReady={setImages} /></div>
        {pickingRegions && <MaskEditor key={`regions-${current.id}`} source={current.url} mode="regions" initialRegionCount={initialRegionCount} onRegionsReady={sources => {
          const pageName = current.pageName || current.name
          const added = sources.map((url, at) => ({ id: crypto.randomUUID(), url, name: `${pageName} · 区域 ${at + 1}`, pageName, region: true }))
          setQueue(previous => previous.flatMap((item, at) => at === index ? added : [item]))
          setImages(null); setEditorVersion(0); setPickingRegions(false); setMessage(`已加入 ${added.length} 个区域，请逐张涂抹答案。`)
        }} />}
      </div> : <button className="upload-paper" onClick={() => input.current?.click()}><span className="tape" /><div className="upload-illustration"><PaperIcon name={saved ? 'check' : 'image'} /></div><h2>{saved ? 'All Done' : 'Add Images'}</h2><span className="paper-button primary"><PaperIcon name="plus" />{saved ? '再添加一些图片' : '选择图片，开始制卡'}</span></button>}
      <div className="creator-savebar">{current ? !pickingRegions && <><button className="paper-button" disabled={!images || !chapterId || busy} onClick={() => saveByInput(true)} onPointerUp={event => { if (event.pointerType === 'touch' && event.isPrimary) { event.preventDefault(); saveByInput(true, true) } }}>保存并继续本图</button><button className="paper-button primary" disabled={!images || !chapterId || busy} onClick={() => saveByInput(false)} onPointerUp={event => { if (event.pointerType === 'touch' && event.isPrimary) { event.preventDefault(); saveByInput(false, true) } }}><PaperIcon name="check" />{busy ? '正在收好…' : index < queue.length - 1 ? '保存，制作下一张' : '保存这张卡片'}</button></> : saved > 0 && <button className="paper-button primary" onClick={() => { if (performance.now() - lastSaveTouch.current > 700) navigate(`/subjects/${subjectId}/chapters/${chapterId}`) }}>去看看我的卡片<PaperIcon name="arrow-right" /></button>}</div>
      <p className="maker-status" role="status">{message}</p>
    </section></div>
  </>
}

export default function StudyApp() {
  const [library, setLibrary] = useState<Library | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const saving = useRef(false)
  const [profile] = useState(profileKey)
  const [location] = useLocation()
  const mapSubject = location.match(/^\/subjects\/([^/]+)/)?.[1] || new URLSearchParams(window.location.search).get('subject')
  useEffect(() => {
    let active = true
    const refresh = () => { void loadLibrary(profile).then(value => { if (active && !saving.current) { if (!syncReminderCards(value.cards, value.reviewGoal || defaultReviewGoal)) setError('资料已读取，但通知计划同步失败，请重开应用重试。'); setLibrary(value) } }).catch(() => { if (active) setError('无法读取本机资料，请保留应用数据后重试。') }) }
    refresh()
    window.addEventListener('memory-cloud-change', refresh)
    return () => { active = false; window.removeEventListener('memory-cloud-change', refresh) }
  }, [profile])
  const persist: Persist = async next => {
    if (saving.current) return false
    saving.current = true
    setBusy(true); setError('')
    try {
      const stored = await saveLibrary(next, library || undefined, profile)
      if (!syncReminderCards(stored.cards, stored.reviewGoal || defaultReviewGoal)) setError('卡片已保存，但通知计划同步失败，请重开应用重试。')
      setLibrary(stored); return true
    }
    catch { setError('这次保存没有成功，可能是本机空间不足。请保留当前页面后重试。'); return false }
    finally { saving.current = false; setBusy(false) }
  }
  return <div className="study-app">
    <title>Memory Library</title>
    <header className="study-topbar"><Link href="/" className="study-brand"><span className="brand-mark"><img src="/icon.png" alt="" /></span><span>MEMORY LIBRARY</span></Link><nav aria-label="主导航"><Link href="/" aria-label="今日复习" className={location === '/' ? 'current' : ''}><PaperIcon name="home" /><span>今日复习</span></Link><Link href="/library" aria-label="学科收纳" className={location === '/library' || location.startsWith('/subjects/') ? 'current' : ''}><PaperIcon name="folder" /><span>学科收纳</span></Link><Link href="/create" aria-label="制作卡片" className={location === '/create' ? 'current' : ''}><PaperIcon name="pencil" /><span>制作卡片</span></Link><a href={mapSubject ? `/mindmap-style?subject=${encodeURIComponent(mapSubject)}` : '/mindmap-style'} aria-label="知识导图"><PaperIcon name="layers" /><span>知识导图</span></a><Link href="/login" aria-label="账号与同步" className={location === '/login' ? 'current' : ''}><svg aria-hidden="true" className="account-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="8" r="3.5"/><path d="M4 21Q4 14 12 14Q20 14 20 21"/></svg><span>账号</span></Link></nav></header>
    <main className="study-main"><SyncIndicator />{error && <div className="storage-error" role="alert">{error}</div>}{library ? <Switch>
      <Route path="/install"><InstallPage /></Route>
      <Route path="/login"><AccountPage /></Route>
      <Route path="/"><TodayReview library={library} persist={persist} busy={busy} /></Route>
      <Route path="/library"><Home library={library} persist={persist} busy={busy} /></Route>
      <Route path="/create"><CreatePage library={library} persist={persist} busy={busy} /></Route>
      <Route path="/subjects/:subjectId/chapters/:chapterId">{params => <ChapterPage key={`${params.subjectId}/${params.chapterId}`} {...params} library={library} persist={persist} busy={busy} />}</Route>
      <Route path="/subjects/:subjectId">{params => <SubjectPage key={params.subjectId} {...params} library={library} persist={persist} busy={busy} />}</Route>
      <Route><Empty title="Page Not Found" text="回到资料库，继续整理你的知识吧。" href="/" action="回到主页" /></Route>
    </Switch> : !error && <p role="status" className="loading-library">正在打开你的资料库…</p>}</main>
  </div>
}
