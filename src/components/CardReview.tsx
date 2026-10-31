import { useState } from 'react'
import type { StudyCard } from '@/lib/study-library'
import type { ReviewResult } from '@/lib/review-schedule'
import { PaperIcon } from './ui/paper-icon'

export function CardReview({ card, busy, onAnswer }: { card: StudyCard; busy: boolean; onAnswer: (result: ReviewResult) => Promise<void> }) {
  const [flipped, setFlipped] = useState(false)
  const [zoom, setZoom] = useState(1)
  return <>
    <div className="image-zoom-controls review-zoom-controls"><button aria-label="缩小卡片图片" disabled={zoom <= 1} onClick={() => setZoom(Math.max(1, zoom - .5))}><PaperIcon name="zoom-out" /></button><span>{Math.round(zoom * 100)}%</span><button aria-label="放大卡片图片" disabled={zoom >= 3} onClick={() => setZoom(Math.min(3, zoom + .5))}><PaperIcon name="zoom-in" /></button></div>
    <div className="review-paper"><span className="tape" /><div className="review-image-viewport"><img style={{ width: `${zoom * 100}%` }} src={flipped ? card.back : card.front} alt={flipped ? '未遮挡的答案' : '遮挡答案的题目'} /></div></div>
    <div className="review-actions"><button className="paper-button" disabled={busy} onClick={() => setFlipped(!flipped)}><PaperIcon name="layers" />{flipped ? '翻回题目再想想' : '翻面核对答案'}</button>{flipped && <div className="answer-pills">{(['wrong', 'correct'] as const).map(result => <button key={result} className={`answer-pill ${result}`} aria-label={result === 'correct' ? '答对了' : '还没记住'} disabled={busy} onClick={() => onAnswer(result)}><svg aria-hidden="true" className="review-mark" viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d={result === 'correct' ? 'M6 18 Q10 22 13 27 Q20 15 30 7' : 'M8 7 Q18 18 28 29 M28 7 Q18 17 8 28'} /></svg></button>)}</div>}</div>
  </>
}
