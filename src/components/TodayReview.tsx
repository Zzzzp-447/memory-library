import { useEffect, useState } from 'react'
import { Link } from 'wouter'
import type { Library } from '@/lib/study-library'
import { defaultReviewGoal, dayStart, dueCards, isMastered, recordReview } from '@/lib/review-schedule'
import { CardReview } from './CardReview'
import { PaperIcon } from './ui/paper-icon'
import { ReminderSettings } from './ReminderSettings'

export function TodayReview({ library, persist, busy }: { library: Library; persist: (next: Library) => Promise<boolean>; busy: boolean }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const update = () => setNow(Date.now())
    const timer = window.setInterval(update, 30000)
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', update)
    return () => { clearInterval(timer); window.removeEventListener('focus', update); document.removeEventListener('visibilitychange', update) }
  }, [])
  const goal = library.reviewGoal || defaultReviewGoal
  const queue = dueCards(library.cards, now, goal)
  const card = queue[0]
  const subject = library.subjects.find(item => item.id === card?.subjectId)
  const chapter = subject?.chapters.find(item => item.id === card?.chapterId)
  const reviewed = library.cards.filter(item => item.lastReviewedAt !== undefined && item.lastReviewedAt >= dayStart(now) && item.lastReviewedAt < dayStart(now, 1)).length
  const mastered = library.cards.filter(item => isMastered(item, goal)).length
  return <section className="today-review">
    <header className="today-heading"><h1>Today</h1><time>{new Date(now).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' })}</time></header>
    <div className="today-summary" role="status"><span>待复习 <strong>{queue.length}</strong> 张</span><span>今日已复习 {reviewed} 张</span><span>已掌握 {mastered} 张</span></div>
    {card ? <article className="daily-review-card" aria-label="今日复习卡片" data-card-id={card.id}>
      <div className="daily-card-heading"><span>{subject?.name || '未分类'} · {chapter?.name || '记忆卡片'}</span><span>{card.tags.join(' · ')}</span></div>
      <CardReview key={card.id} card={card} busy={busy} onAnswer={async result => {
        const answeredAt = Date.now()
        if (await persist({ ...library, cards: library.cards.map(item => item.id === card.id ? recordReview(item, result, answeredAt) : item) })) {
          navigator.vibrate?.(20); setNow(answeredAt)
        }
      }} />
    </article> : <div className="today-complete"><PaperIcon name="book-open" /><h2>{library.cards.length ? 'All Done' : 'Your First Card'}</h2><p>{library.cards.length ? '今天的到期卡片已复习完，明天再来。' : '先收好一道题，开始你的复习。'}</p><Link className="paper-button primary" href={library.cards.length ? '/library' : '/create'}>{library.cards.length ? '打开资料库' : '制作第一张卡片'}<PaperIcon name="arrow-right" /></Link></div>}
    <ReminderSettings />
  </section>
}
