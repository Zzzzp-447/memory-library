import type { StudyCard } from './study-library'

export type ReviewResult = 'wrong' | 'correct'
const intervals = [1, 2, 4, 7, 15, 30]
export const defaultReviewGoal = 6

export function dayStart(time: number, days = 0): number {
  const date = new Date(time)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return date.getTime()
}

export const isMastered = (card: StudyCard, goal: number) => (card.reviewStreak || 0) >= goal

export function dueCards(cards: StudyCard[], now: number, goal: number): StudyCard[] {
  const tomorrow = dayStart(now, 1)
  return cards.filter(card => !isMastered(card, goal) && (card.nextReviewAt ?? card.createdAt) < tomorrow)
    .sort((a, b) => (a.nextReviewAt ?? a.createdAt) - (b.nextReviewAt ?? b.createdAt) || a.createdAt - b.createdAt || a.id.localeCompare(b.id))
}

export function recordReview(card: StudyCard, result: ReviewResult, now: number): StudyCard {
  const step = Math.max(0, Math.min(intervals.length - 1, card.reviewStep || 0))
  return { ...card, [result]: card[result] + 1, lastReviewedAt: now,
    reviewStreak: result === 'correct' ? (card.reviewStreak || 0) + 1 : 0,
    reviewStep: result === 'correct' ? Math.min(intervals.length - 1, step + 1) : Math.max(0, step - 1),
    nextReviewAt: dayStart(now, result === 'correct' ? intervals[step] : 1),
  }
}
