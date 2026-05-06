import Dexie, { type Table } from 'dexie'

export interface Person {
  id?: number
  name: string
  relationship: 'partner' | 'family' | 'friend' | 'colleague' | 'other'
  birthday?: string  // 'YYYY-MM-DD'
  notes?: string
  createdAt: number
}

export interface Fact {
  id?: number
  personId: number
  key: string          // 예: "알러지", "선호 음식", "스트레스 트리거"
  value: string
  confidence: number   // 0-1
  sourceMessageId?: number
  createdAt: number
}

export interface Episode {
  id?: number
  personId: number | null    // null = 일반 일기
  content: string
  embedding?: number[]       // Day 3에서 채움
  createdAt: number
}

export interface Message {
  id?: number
  role: 'user' | 'assistant'
  content: string
  createdAt: number
}

class DiaryDB extends Dexie {
  people!: Table<Person>
  facts!: Table<Fact>
  episodes!: Table<Episode>
  messages!: Table<Message>

  constructor() {
    super('PersonalDiary')
    this.version(1).stores({
      people:   '++id, name, relationship',
      facts:    '++id, personId, key, [personId+key]',
      episodes: '++id, personId, createdAt',
      messages: '++id, createdAt',
    })
  }
}

export const db = new DiaryDB()
