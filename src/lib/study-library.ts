import localforage from 'localforage'
import { profileKey } from './cloud-session'
import { loadCloudLibrary, saveCloudLibrary } from './cloud-sync'

export type PaperColor = 'blue' | 'yellow' | 'cream' | 'red'
export interface Chapter { id: string; name: string }
export interface Subject { id: string; name: string; color: PaperColor; face: number; chapters: Chapter[] }
export interface StudyCard {
  id: string; subjectId: string; chapterId: string; front: string; back: string;
  tags: string[]; createdAt: number; correct: number; wrong: number;
  nextReviewAt?: number; lastReviewedAt?: number; reviewStep?: number; reviewStreak?: number;
  mapSupplement?: { kind: 'knowledge' | 'technique'; text: string };
}
export interface Library { subjects: Subject[]; cards: StudyCard[]; reviewGoal?: number }

const db = localforage.createInstance({ name: 'mistake-card-library', storeName: 'library' })
export const initialLibrary: Library = {
  subjects: [
    { id: 'math', name: '高等数学', color: 'blue', face: 0, chapters: [
      { id: 'limits', name: '极限与连续' }, { id: 'derivatives', name: '导数与微分' },
      { id: 'applications', name: '微分中值定理与应用' }, { id: 'integrals', name: '不定积分' },
      { id: 'definite', name: '定积分及其应用' }, { id: 'series', name: '无穷级数' },
    ] },
    { id: 'english', name: '英语积累', color: 'yellow', face: 1, chapters: [
      { id: 'words', name: '单词与短语' }, { id: 'sentences', name: '例句与长难句' },
      { id: 'reading', name: '阅读与语法' }, { id: 'writing', name: '作文表达' },
    ] },
  ], cards: [],
}

export async function loadGuestLibrary(): Promise<Library> {
  const saved = await db.getItem<Library>('data')
  if (!saved) return structuredClone(initialLibrary)
  if (!Array.isArray(saved.subjects) || !Array.isArray(saved.cards)) {
    throw new Error('资料库格式异常，请先保留浏览器数据。')
  }
  return saved
}

export async function loadLibrary(profile = profileKey()): Promise<Library> {
  return profile === 'guest' ? loadGuestLibrary() : loadCloudLibrary(profile)
}

export async function saveLibrary(value: Library, previous?: Library, profile = profileKey()): Promise<Library> {
  if (profile !== profileKey()) throw new Error('账号已切换，请刷新后再保存。')
  if (profile !== 'guest') return saveCloudLibrary(value, previous || await loadCloudLibrary(profile), profile)
  await db.setItem('data', value)
  return value
}
