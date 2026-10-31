import type { StudyCard } from './study-library'

interface ReminderStatus { enabled: boolean; hour: number; minute: number; permitted: boolean; scheduledAt: number; error?: string; testMessage?: string }
interface ReminderBridge {
  getStatus: () => string
  configure: (enabled: boolean, hour: number, minute: number) => void
  syncCards: (json: string) => void
  testNotification: () => void
  openSettings: () => void
}
export const reminderBridge = () => (window as Window & { MemoryReminder?: ReminderBridge }).MemoryReminder
export function readReminderStatus(): ReminderStatus | null {
  try {
    const native = reminderBridge()
    if (!native) return null
    const status = JSON.parse(native.getStatus()) as ReminderStatus
    return typeof status.enabled === 'boolean' && Number.isInteger(status.hour) && Number.isInteger(status.minute) ? status : null
  } catch { return null }
}

// Reminder failures cannot turn a successful card save into a failed save.
export function syncReminderCards(cards: StudyCard[], goal: number) {
  try {
    reminderBridge()?.syncCards(JSON.stringify({ goal, cards: cards.map(card => ({ dueAt: card.nextReviewAt ?? card.createdAt, streak: card.reviewStreak || 0 })) }))
    return true
  } catch { return false }
}
