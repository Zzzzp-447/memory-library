const fs = require('node:fs')
const assert = require('node:assert/strict')
const ts = require('typescript')
const api = {}
new Function('exports', ts.transpileModule(fs.readFileSync('src/lib/review-schedule.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(api)
const { recordReview, dueCards, dayStart, isMastered } = api
const now = new Date(2026, 9, 28, 15).getTime()
const base = { id: 'old', createdAt: dayStart(now, -3), correct: 2, wrong: 1 }
const reviewed = recordReview(base, 'correct', now)
assert.equal(reviewed.correct, 3)
assert.equal(reviewed.wrong, 1)
assert.equal(reviewed.nextReviewAt, dayStart(now, 1))
assert.equal(reviewed.reviewStreak, 1, 'Historical total correct answers do not prove a consecutive streak')
assert.equal(base.nextReviewAt, undefined, 'Scheduling must not mutate the saved card')
assert.deepEqual(dueCards([reviewed], now, 6), [])
assert.equal(dueCards([reviewed], dayStart(now, 1), 6).length, 1)
let current = base
for (const days of [1, 2, 4, 7, 15, 30]) {
  current = recordReview(current, 'correct', now)
  assert.equal(current.nextReviewAt, dayStart(now, days))
}
assert.ok(isMastered(current, 6))
assert.deepEqual(dueCards([current], dayStart(now, 100), 6), [])
const wrong = recordReview(current, 'wrong', now)
assert.equal(wrong.reviewStreak, 0)
assert.equal(wrong.nextReviewAt, dayStart(now, 1))
assert.equal(dueCards([wrong], dayStart(now, 1), 6).length, 1, 'Manual wrong answers reactivate mastered cards')
const future = { ...base, id: 'future', nextReviewAt: dayStart(now, 1) }
const overdue = { ...base, id: 'overdue', nextReviewAt: dayStart(now, -5) }
assert.deepEqual(dueCards([future, base, overdue], now, 6).map(card => card.id), ['overdue', 'old'])
assert.equal(dayStart(new Date(2026, 11, 31, 23).getTime(), 1), new Date(2027, 0, 1).getTime())
process.env.TZ = 'America/New_York'
const dst = new Date(2026, 2, 8, 0).getTime()
assert.equal(dayStart(dst, 1), new Date(2026, 2, 9, 0).getTime(), 'Use local calendar days across DST changes')
assert.equal(dayStart(dst, 1) - dst, 23 * 60 * 60 * 1000)
console.log('PASS: legacy cards, due ordering, spacing, streak goals, reactivation, immutable updates, year boundary and daylight-saving calendar days.')
