import { useState, useEffect } from 'react'
import { db, type Person, type Fact } from '@/db/schema'

const RELATIONSHIP_LABELS: Record<Person['relationship'], string> = {
  partner: '연인',
  family: '가족',
  friend: '친구',
  colleague: '동료',
  other: '기타',
}

export function People() {
  const [people, setPeople] = useState<Person[]>([])
  const [factsByPerson, setFactsByPerson] = useState<Record<number, Fact[]>>({})
  const [name, setName] = useState('')
  const [relationship, setRelationship] = useState<Person['relationship']>('partner')
  const [birthday, setBirthday] = useState('')
  const [notes, setNotes] = useState('')

  async function refresh() {
    const ps = await db.people.toArray()
    setPeople(ps)
    const factMap: Record<number, Fact[]> = {}
    for (const p of ps) {
      if (p.id) {
        factMap[p.id] = await db.facts
          .where('personId')
          .equals(p.id)
          .toArray()
      }
    }
    setFactsByPerson(factMap)
  }

  useEffect(() => {
    refresh()
  }, [])

  async function add() {
    if (!name.trim()) return
    await db.people.add({
      name: name.trim(),
      relationship,
      birthday: birthday || undefined,
      notes: notes.trim() || undefined,
      createdAt: Date.now(),
    })
    setName('')
    setBirthday('')
    setNotes('')
    refresh()
  }

  async function remove(id: number) {
    if (!confirm('정말 삭제할까?')) return
    await db.people.delete(id)
    await db.facts.where('personId').equals(id).delete()
    await db.episodes.where('personId').equals(id).delete()
    refresh()
  }

  async function removeFact(id: number) {
    await db.facts.delete(id)
    refresh()
  }

  return (
    <div className="max-w-xl mx-auto p-8">
      <h1 className="text-3xl mb-2">사람들</h1>
      <p className="text-[var(--color-ink-soft)] mb-8 italic">
        기억하고 싶은 사람들.
      </p>

      <div className="border border-[var(--color-line)] bg-white rounded-lg p-5 mb-6 space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름"
          className="w-full border-b border-[var(--color-line)] py-2 focus:outline-none focus:border-[var(--color-ink)] bg-transparent"
        />
        <select
          value={relationship}
          onChange={(e) => setRelationship(e.target.value as Person['relationship'])}
          className="w-full border-b border-[var(--color-line)] py-2 focus:outline-none focus:border-[var(--color-ink)] bg-transparent"
        >
          {Object.entries(RELATIONSHIP_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <input
          type="date"
          value={birthday}
          onChange={(e) => setBirthday(e.target.value)}
          className="w-full border-b border-[var(--color-line)] py-2 focus:outline-none focus:border-[var(--color-ink)] bg-transparent"
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="이 사람에 대한 메모 (선택)"
          rows={3}
          className="w-full border border-[var(--color-line)] rounded p-2 text-sm focus:outline-none focus:border-[var(--color-ink)] bg-transparent resize-none"
        />
        <button
          onClick={add}
          disabled={!name.trim()}
          className="bg-[var(--color-ink)] text-[var(--color-paper)] px-5 py-2 rounded-lg w-full disabled:opacity-30"
        >
          추가
        </button>
      </div>

      <div className="space-y-2">
        {people.length === 0 && (
          <p className="text-[var(--color-ink-soft)] text-center py-12 italic">
            아직 등록된 사람이 없어요.
          </p>
        )}
        {people.map((p) => {
          const facts = p.id ? factsByPerson[p.id] ?? [] : []
          return (
            <div
              key={p.id}
              className="border border-[var(--color-line)] bg-white rounded-lg p-4"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="font-medium text-lg">{p.name}</div>
                  <div className="text-sm text-[var(--color-ink-soft)]">
                    {RELATIONSHIP_LABELS[p.relationship]}
                    {p.birthday && ` · ${p.birthday}`}
                  </div>
                  {p.notes && (
                    <div className="text-sm mt-2 text-[var(--color-ink-soft)]">{p.notes}</div>
                  )}
                </div>
                <button
                  onClick={() => p.id && remove(p.id)}
                  className="text-[var(--color-accent)] text-sm hover:underline"
                >
                  삭제
                </button>
              </div>

              {facts.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[var(--color-line)] space-y-1">
                  <div className="text-xs text-[var(--color-ink-soft)] mb-1 italic">
                    대화에서 알게 된 것들
                  </div>
                  {facts.map((f) => (
                    <div key={f.id} className="flex items-center justify-between text-sm group">
                      <div>
                        <span className="text-[var(--color-ink-soft)]">{f.key}</span>
                        <span className="mx-2 text-[var(--color-line)]">·</span>
                        <span>{f.value}</span>
                      </div>
                      <button
                        onClick={() => f.id && removeFact(f.id)}
                        className="text-[var(--color-accent)] text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
