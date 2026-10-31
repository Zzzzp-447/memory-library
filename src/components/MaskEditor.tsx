import { useEffect, useRef, useState } from 'react'
import { PaperIcon } from './ui/paper-icon'

interface Point { x: number; y: number }
interface Stroke { points: Point[]; width: number }
interface Crop { start: Point; end: Point }
const hasArea = (value: Crop | null): value is Crop => !!value && Math.abs(value.end.x - value.start.x) >= .02 && Math.abs(value.end.y - value.start.y) >= .02
const defaultRegion = (index: number): Crop => index === 0 ? { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } : { start: { x: .1 + index % 5 * .03, y: .1 + index % 5 * .04 }, end: { x: .85 + index % 5 * .03, y: .4 + index % 5 * .04 } }
export interface CardImages { front: string; back: string }

export function MaskEditor({ source, onReady, mode = 'mask', onRegionsReady, initialRegionCount = 1 }: { source: string; onReady?: (images: CardImages | null) => void; mode?: 'mask' | 'regions'; onRegionsReady?: (regions: string[]) => void; initialRegionCount?: number }) {
  const regionMode = mode === 'regions'
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const drawing = useRef(false)
  const activeStroke = useRef<Stroke | null>(null)
  const activePointer = useRef<number | null>(null)
  const applyingCrop = useRef(false)
  const regionStart = useRef<Point | null>(null)
  const lastRegionTouch = useRef(-1000)
  const finishingRegions = useRef(false)
  const [regions, setRegions] = useState<Crop[]>(() => Array.from({ length: initialRegionCount }, (_, index) => defaultRegion(index)))
  const [activeRegion, setActiveRegion] = useState(initialRegionCount - 1)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [brush, setBrush] = useState(28)
  const [showAnswer, setShowAnswer] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [cropping, setCropping] = useState(regionMode)
  const [crop, setCrop] = useState<Crop | null>(null)
  const [workingSource, setWorkingSource] = useState(source)
  const [zoom, setZoom] = useState(1)
  const [panning, setPanning] = useState(false)
  const onReadyRef = useRef(onReady)
  useEffect(() => { onReadyRef.current = onReady }, [onReady])

  useEffect(() => {
    let cancelled = false
    onReadyRef.current?.(null)
    const image = new Image()
    image.onload = () => {
      if (cancelled) return
      imageRef.current = image
      applyingCrop.current = false
      const canvas = canvasRef.current!
      const scale = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight))
      canvas.width = Math.round(image.naturalWidth * scale)
      canvas.height = Math.round(image.naturalHeight * scale)
      setLoaded(true)
      setStrokes([])
      setError('')
    }
    image.onerror = () => { if (!cancelled) setError('这张图片无法读取，请换一张图片。') }
    image.src = workingSource
    return () => { cancelled = true }
  }, [workingSource])

  const paint = (all: Stroke[], reveal = false) => {
    const canvas = canvasRef.current
    const image = imageRef.current
    if (!canvas || !image) return
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    if (reveal) return
    ctx.strokeStyle = '#f2efe0'
    ctx.fillStyle = '#f2efe0'
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'
    for (const stroke of all) {
      ctx.lineWidth = stroke.width * canvas.width
      ctx.beginPath()
      stroke.points.forEach((point, index) => {
        if (index === 0) ctx.moveTo(point.x * canvas.width, point.y * canvas.height)
        ctx.lineTo(point.x * canvas.width, point.y * canvas.height)
      })
      ctx.stroke()
      if (stroke.points.length === 1) {
        const point = stroke.points[0]
        ctx.beginPath(); ctx.arc(point.x * canvas.width, point.y * canvas.height, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill()
      }
    }
  }

  // Drawing is local to the canvas; no image is sent to a server.
  useEffect(() => {
    if (!loaded || !canvasRef.current || !imageRef.current) return
    paint([], true)
    if (regionMode) return
    const back = canvasRef.current.toDataURL('image/jpeg', .88)
    paint(strokes)
    const front = canvasRef.current.toDataURL('image/jpeg', .88)
    onReadyRef.current?.({ front, back })
    if (showAnswer) paint([], true)
  }, [loaded, strokes, showAnswer, workingSource, regionMode])

  const pointAt = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) }
  }

  const applyCrop = () => {
    if (!crop || !imageRef.current || applyingCrop.current) return
    if (Math.abs(crop.end.x - crop.start.x) < .02 || Math.abs(crop.end.y - crop.start.y) < .02) return
    applyingCrop.current = true
    const image = imageRef.current
    const x = Math.min(crop.start.x, crop.end.x) * image.naturalWidth
    const y = Math.min(crop.start.y, crop.end.y) * image.naturalHeight
    const width = Math.abs(crop.end.x - crop.start.x) * image.naturalWidth
    const height = Math.abs(crop.end.y - crop.start.y) * image.naturalHeight
    const result = document.createElement('canvas'); result.width = Math.round(width); result.height = Math.round(height)
    result.getContext('2d')!.drawImage(image, x, y, width, height, 0, 0, result.width, result.height)
    setLoaded(false); setWorkingSource(result.toDataURL('image/jpeg', .92)); setCrop(null); setCropping(false); setZoom(1); setPanning(false)
  }

  const addRegion = () => {
    setRegions(previous => [...previous, defaultRegion(previous.length)]); setActiveRegion(regions.length); setCrop(null)
  }
  const deleteRegion = (index: number) => {
    setRegions(previous => previous.length > 1 ? previous.filter((_, at) => at !== index) : previous)
    setActiveRegion(value => Math.max(0, value > index ? value - 1 : value === index ? 0 : value))
  }
  const finishRegions = () => {
    const image = imageRef.current
    const selected = regions
    if (!image || !selected.length || finishingRegions.current || !onRegionsReady) return
    finishingRegions.current = true
    try {
      const sources = selected.map(region => {
        if (region.start.x === 0 && region.start.y === 0 && region.end.x === 1 && region.end.y === 1) return workingSource
        const x = Math.min(region.start.x, region.end.x) * image.naturalWidth
        const y = Math.min(region.start.y, region.end.y) * image.naturalHeight
        const width = Math.abs(region.end.x - region.start.x) * image.naturalWidth
        const height = Math.abs(region.end.y - region.start.y) * image.naturalHeight
        const scale = Math.min(1, 1800 / Math.max(width, height))
        const result = document.createElement('canvas')
        result.width = Math.max(1, Math.round(width * scale)); result.height = Math.max(1, Math.round(height * scale))
        result.getContext('2d')!.drawImage(image, x, y, width, height, 0, 0, result.width, result.height)
        return result.toDataURL('image/jpeg', .92)
      })
      onRegionsReady(sources)
    } catch { finishingRegions.current = false; setError('框选区域未能处理，请保留当前图片并重试。') }
  }
  const regionCount = regions.length

  return <div className="mask-editor">
    <div className="editor-tools">
      {!regionMode && <button type="button" className={!cropping && !panning ? 'active' : ''} onClick={() => { setCropping(false); setPanning(false); setCrop(null); setShowAnswer(false) }}><PaperIcon name="pencil" />涂抹答案</button>}
      <button type="button" className={cropping && !panning ? 'active' : ''} onClick={() => { setCropping(true); setPanning(false); setShowAnswer(false) }}><PaperIcon name="maximize" />{regionMode ? '框选区域' : '框选题目'}</button>
      <button type="button" className={panning ? 'active' : ''} aria-pressed={panning} onClick={() => setPanning(!panning)}><PaperIcon name="maximize" />移动图片</button>
      <button type="button" disabled={regionMode ? !crop && regions.length <= 1 : !strokes.length} onClick={() => { if (regionMode) { if (crop) setCrop(null); else { setRegions(previous => previous.slice(0, -1)); setActiveRegion(value => Math.min(value, regions.length - 2)) } } else setStrokes(strokes.slice(0, -1)) }}><PaperIcon name="undo" />撤销</button>
      {!regionMode && <label className="brush-control">笔刷<input aria-label="笔刷大小" type="range" min="8" max="72" value={brush} onChange={event => setBrush(Number(event.target.value))} /></label>}
      <div className="image-zoom-controls"><button type="button" aria-label="缩小编辑图片" disabled={zoom <= 1} onClick={() => { setZoom(Math.max(1, zoom - .5)); setPanning(true) }}><PaperIcon name="zoom-out" /></button><span>{Math.round(zoom * 100)}%</span><button type="button" aria-label="放大编辑图片" disabled={zoom >= 3} onClick={() => { setZoom(Math.min(3, zoom + .5)); setPanning(true) }}><PaperIcon name="zoom-in" /></button></div>
    </div>
    <div className="mask-viewport" aria-label="可移动的图片视口"><div className="mask-stage" style={{ width: `${zoom * 100}%` }}>
      {error && <p role="alert">{error}</p>}
      <canvas ref={canvasRef} style={{ touchAction: panning ? 'pan-x pan-y' : 'none' }} aria-label={regionMode ? '框选区域编辑区，拖动调整当前区域' : '图片制卡编辑区，拖动涂抹答案或框选题目'} onPointerDown={event => {
        if (!event.isPrimary) {
          drawing.current = false; activePointer.current = null; activeStroke.current = null
          if (cropping) { setCrop(null); regionStart.current = null }
          paint(strokes, showAnswer)
          return
        }
        if (!loaded || showAnswer || panning) return
        event.currentTarget.setPointerCapture(event.pointerId)
        activePointer.current = event.pointerId
        drawing.current = true
        const point = pointAt(event)
        if (cropping) { regionStart.current = point; setCrop({ start: point, end: point }) }
        else {
          activeStroke.current = { points: [point], width: brush / event.currentTarget.getBoundingClientRect().width }
          paint([...strokes, activeStroke.current])
        }
      }} onPointerMove={event => {
        if (!drawing.current || activePointer.current !== event.pointerId) return
        const point = pointAt(event)
        if (cropping) setCrop(previous => previous ? { ...previous, end: point } : null)
        else if (activeStroke.current) { activeStroke.current.points.push(point); paint([...strokes, activeStroke.current]) }
      }} onPointerUp={event => {
        if (activePointer.current !== event.pointerId) return
        const end = pointAt(event)
        if (cropping) {
          if (regionMode) { const next = regionStart.current ? { start: regionStart.current, end } : null; if (hasArea(next)) setRegions(previous => previous.map((region, index) => index === activeRegion ? next : region)); setCrop(null); regionStart.current = null }
          else setCrop(previous => previous ? { ...previous, end } : null)
        }
        if (activeStroke.current) activeStroke.current.points.push(end)
        drawing.current = false
        activePointer.current = null
        if (activeStroke.current) { setStrokes([...strokes, activeStroke.current]); activeStroke.current = null }
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
      }} onPointerCancel={() => { drawing.current = false; activePointer.current = null; activeStroke.current = null; regionStart.current = null; if (cropping) setCrop(null); paint(strokes, showAnswer) }} />
      {regionMode && regions.map((region, index) => <div key={index} className={`region-outline${index === activeRegion ? ' active' : ''}`} style={{ left: `${Math.min(region.start.x, region.end.x) * 100}%`, top: `${Math.min(region.start.y, region.end.y) * 100}%`, width: `${Math.abs(region.end.x - region.start.x) * 100}%`, height: `${Math.abs(region.end.y - region.start.y) * 100}%` }}><span>{index + 1}</span></div>)}
      {cropping && crop && <div className="crop-outline" style={{ left: `${Math.min(crop.start.x, crop.end.x) * 100}%`, top: `${Math.min(crop.start.y, crop.end.y) * 100}%`, width: `${Math.abs(crop.end.x - crop.start.x) * 100}%`, height: `${Math.abs(crop.end.y - crop.start.y) * 100}%` }} />}
    </div></div>
    {regionMode && <div className="region-list" aria-label="已框选的区域">{regions.map((_, index) => <div key={index}><button type="button" aria-pressed={index === activeRegion} onClick={() => { setActiveRegion(index); setCrop(null) }} onPointerUp={event => { if (event.pointerType === 'touch' && event.isPrimary) { event.preventDefault(); setActiveRegion(index); setCrop(null) } }}>区域 {index + 1}</button><button type="button" disabled={regions.length <= 1} aria-label={`删除区域 ${index + 1}`} onClick={() => { if (performance.now() - lastRegionTouch.current > 700) deleteRegion(index) }} onPointerUp={event => { if (event.pointerType === 'touch' && event.isPrimary) { event.preventDefault(); lastRegionTouch.current = performance.now(); deleteRegion(index) } }}><PaperIcon name="x" /></button></div>)}</div>}
    <div className="editor-bottom">
      {regionMode ? <><button type="button" disabled={!loaded} onClick={() => { if (performance.now() - lastRegionTouch.current > 700) addRegion() }} onPointerUp={event => { if (event.pointerType === 'touch' && event.isPrimary) { event.preventDefault(); lastRegionTouch.current = performance.now(); addRegion() } }}><PaperIcon name="plus" />添加框选区域</button><button type="button" disabled={!loaded || !regionCount} onClick={finishRegions} onPointerUp={event => { if (event.pointerType === 'touch' && event.isPrimary) { event.preventDefault(); finishRegions() } }}><PaperIcon name="check" />开始制卡（{regionCount} 张）</button></> : cropping ? <button type="button" disabled={!crop || Math.abs(crop.end.x - crop.start.x) < .02 || Math.abs(crop.end.y - crop.start.y) < .02} onClick={applyCrop} onPointerUp={event => {
        // Touch confirmation must not depend on a compatibility mouse click after a canvas drag.
        if (event.pointerType === 'touch' && event.isPrimary) { event.preventDefault(); applyCrop() }
      }}><PaperIcon name="check" />确认框选</button> : <button type="button" onClick={() => setShowAnswer(!showAnswer)}><PaperIcon name="layers" />{showAnswer ? '查看卡片正面' : '预览背面答案'}</button>}
    </div>
  </div>
}
