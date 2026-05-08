import { useState, useEffect } from 'react'
import { db, type Person, type Fact } from '@/db/schema'
import { logActivityEvent } from '@/lib/diary-state'

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
  const [editingId, setEditingId] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)

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

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(t)
  }, [toast])

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
    const p = people.find((x) => x.id === id)
    const factCount = factsByPerson[id]?.length ?? 0
    const epCount = await db.episodes.where('personId').equals(id).count()
    const lossDetail =
      factCount + epCount > 0
        ? `\n\n⚠️ 함께 삭제됨: 알게 된 것 ${factCount}개, 일화 ${epCount}개\n복구 불가능합니다.`
        : ''
    if (!confirm(`"${p?.name}"를 정말 삭제할까요?${lossDetail}`)) return
    await db.people.delete(id)
    await db.facts.where('personId').equals(id).delete()
    await db.episodes.where('personId').equals(id).delete()
    refresh()
  }

  async function removeFact(id: number) {
    await db.facts.delete(id)
    // dogfooding precision metric — 사용자가 직접 ✕로 지운 fact는 false-positive 인디케이터
    logActivityEvent('fact-deleted')
    refresh()
  }

  async function saveEdit(id: number, patch: Partial<Person>) {
    // 데이터 보존: facts/episodes는 personId로 연결되니 update만 하면 그대로 유지됨
    await db.people.update(id, patch)
    setEditingId(null)
    setToast('✓ 수정됨 (알게 된 것 / 일화 그대로 보존)')
    refresh()
  }

  return (
    <div className="max-w-xl mx-auto p-6 sm:p-8">
      <PageHeader title="사람들" subtitle="기억하고 싶은 사람들" ornament="❀" />

      {toast && (
        <div
          className="fixed top-16 right-4 bg-[var(--color-ink-warm)] text-[var(--color-paper)] px-4 py-2 rounded-lg text-sm z-50 animate-in fade-in slide-in-from-top-2"
          style={{ boxShadow: 'var(--shadow-lift)' }}
        >
          {toast}
        </div>
      )}

      <div className="card p-5 mb-6 space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름"
          className="w-full border-b border-[var(--color-line)] py-2 focus:outline-none focus:border-[var(--color-ink-warm)] bg-transparent transition-colors"
        />
        <select
          value={relationship}
          onChange={(e) => setRelationship(e.target.value as Person['relationship'])}
          className="w-full border-b border-[var(--color-line)] py-2 focus:outline-none focus:border-[var(--color-ink-warm)] bg-transparent transition-colors"
        >
          {Object.entries(RELATIONSHIP_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={birthday}
          onChange={(e) => setBirthday(e.target.value)}
          className="w-full border-b border-[var(--color-line)] py-2 focus:outline-none focus:border-[var(--color-ink-warm)] bg-transparent transition-colors"
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="이 사람에 대한 메모 (선택)"
          rows={3}
          className="w-full border border-[var(--color-line)] rounded p-2 text-sm focus:outline-none focus:border-[var(--color-ink-warm)] bg-transparent resize-none transition-colors"
        />
        <button
          onClick={add}
          disabled={!name.trim()}
          className="btn-primary w-full"
        >
          추가
        </button>
      </div>

      <div className="space-y-3">
        {people.length === 0 && (
          <p className="text-[var(--color-ink-soft)] text-center py-12 italic font-display">
            아직 등록된 사람이 없어요.
          </p>
        )}
        {people.map((p) => {
          const facts = p.id ? factsByPerson[p.id] ?? [] : []
          const isEditing = editingId === p.id
          return (
            <div
              key={p.id}
              className="card-ruled p-4 sm:p-5 transition-shadow hover:[box-shadow:var(--shadow-lift)]"
            >
              {isEditing ? (
                <PersonEditForm
                  person={p}
                  onSave={(patch) => p.id && saveEdit(p.id, patch)}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <>
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-display italic text-xl text-[var(--color-ink-warm)] leading-tight">
                        {p.name}
                      </div>
                      <div className="text-xs uppercase tracking-[0.14em] text-[var(--color-ink-soft)] mt-1.5">
                        {RELATIONSHIP_LABELS[p.relationship]}
                        {p.birthday && (
                          <>
                            <span className="mx-1.5 text-[var(--color-gold)]">·</span>
                            <span className="tabular-nums normal-case tracking-normal">
                              {p.birthday}
                            </span>
                          </>
                        )}
                      </div>
                      {p.notes && (
                        <div className="text-sm mt-2.5 text-[var(--color-ink-soft)] leading-relaxed">
                          {p.notes}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <button
                        onClick={() => setEditingId(p.id ?? null)}
                        className="text-[var(--color-ink-soft)] text-xs hover:text-[var(--color-gold)] transition-colors"
                      >
                        편집
                      </button>
                      <button
                        onClick={() => p.id && remove(p.id)}
                        className="text-[var(--color-accent)] text-xs hover:underline opacity-60 hover:opacity-100 transition-opacity"
                      >
                        삭제
                      </button>
                    </div>
                  </div>

                  {facts.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-dashed border-[var(--color-line)] space-y-1.5">
                      <div className="eyebrow mb-1.5 flex items-center gap-1.5">
                        <span className="text-[var(--color-gold)]">✦</span>
                        대화에서 알게 된 것들
                      </div>
                      {facts.map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center justify-between text-sm group"
                        >
                          <div>
                            <span className="text-[var(--color-ink-soft)] font-display italic">
                              {f.key}
                            </span>
                            <span className="mx-2 text-[var(--color-gold)]/60">·</span>
                            <span className="text-[var(--color-ink-warm)]">{f.value}</span>
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
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PersonEditForm({
  person,
  onSave,
  onCancel,
}: {
  person: Person
  onSave: (patch: Partial<Person>) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(person.name)
  const [relationship, setRelationship] = useState<Person['relationship']>(person.relationship)
  const [birthday, setBirthday] = useState(person.birthday ?? '')
  const [notes, setNotes] = useState(person.notes ?? '')

  const dirty =
    name.trim() !== person.name ||
    relationship !== person.relationship ||
    (birthday || '') !== (person.birthday ?? '') ||
    notes.trim() !== (person.notes ?? '')

  function handleSave() {
    if (!name.trim() || !dirty) return
    onSave({
      name: name.trim(),
      relationship,
      // 빈 string은 undefined로 normalize — schema의 optional 필드 의도 보존
      birthday: birthday || undefined,
      notes: notes.trim() || undefined,
    })
  }

  return (
    <div className="space-y-3">
      <div className="eyebrow flex items-center gap-1.5">
        <span className="text-[var(--color-gold)]">✦</span>
        편집 중
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="이름"
        className="w-full border-b border-[var(--color-line)] py-2 focus:outline-none focus:border-[var(--color-ink-warm)] bg-transparent transition-colors text-base"
      />
      <select
        value={relationship}
        onChange={(e) => setRelationship(e.target.value as Person['relationship'])}
        className="w-full border-b border-[var(--color-line)] py-2 focus:outline-none focus:border-[var(--color-ink-warm)] bg-transparent transition-colors text-sm"
      >
        {Object.entries(RELATIONSHIP_LABELS).map(([k, v]) => (
          <option key={k} value={k}>
            {v}
          </option>
        ))}
      </select>
      <input
        type="date"
        value={birthday}
        onChange={(e) => setBirthday(e.target.value)}
        className="w-full border-b border-[var(--color-line)] py-2 focus:outline-none focus:border-[var(--color-ink-warm)] bg-transparent transition-colors text-sm"
      />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="이 사람에 대한 메모 (선택)"
        rows={3}
        className="w-full border border-[var(--color-line)] rounded p-2 text-sm focus:outline-none focus:border-[var(--color-ink-warm)] bg-transparent resize-none transition-colors"
      />
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!name.trim() || !dirty}
          className="btn-primary flex-1"
        >
          저장
        </button>
        <button onClick={onCancel} className="btn-secondary">
          취소
        </button>
      </div>
      <p className="text-[10px] text-[var(--color-ink-soft)] italic">
        편집은 알게 된 것 / 일화에 영향을 주지 않아요.
      </p>
    </div>
  )
}

function PageHeader({
  title,
  subtitle,
  ornament,
}: {
  title: string
  subtitle?: string
  ornament?: string
}) {
  return (
    <header className="mb-8 ink-in">
      {ornament && (
        <div className="text-[var(--color-gold)] text-sm mb-2">{ornament}</div>
      )}
      <h1 className="font-display italic text-4xl text-[var(--color-ink-warm)] leading-tight">
        {title}
      </h1>
      {subtitle && (
        <p className="text-[var(--color-ink-soft)] mt-1.5 italic font-display">
          {subtitle}
        </p>
      )}
      <div className="mt-4 h-px bg-gradient-to-r from-[var(--color-gold)] via-[var(--color-line)] to-transparent" />
    </header>
  )
}
