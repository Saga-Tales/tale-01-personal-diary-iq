import { useState, useEffect } from 'react'
import { db, type Person } from '@/db/schema'
import {
  generateBirthdaysIcal,
  downloadFile,
  getUpcomingBirthdays,
  type UpcomingBirthday,
} from '@/lib/ical'
import { exportBackup, restoreBackup, type RestoreResult } from '@/lib/backup'
import {
  parseKakaoExport,
  groupByDay,
  importChunks,
  readKakaoFile,
  type DailyChunk,
  type ImportProgress,
} from '@/lib/kakao'
import { FileDropZone } from '@/components/FileDropZone'

export function Data() {
  return (
    <div className="max-w-2xl mx-auto p-6 sm:p-8 space-y-6">
      <header className="mb-2">
        <h1 className="text-3xl mb-1">데이터</h1>
        <p className="text-[var(--color-ink-soft)] italic text-sm">
          백업, 가져오기, 기념일.
        </p>
      </header>

      <BirthdaysCard />
      <BackupCard />
      <KakaoImportCard />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 카드 공통
// ─────────────────────────────────────────────────────────────
function Card({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: string
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <section className="border border-[var(--color-line)] bg-white rounded-xl p-6 shadow-sm">
      <header className="flex items-baseline gap-3 mb-4 pb-4 border-b border-[var(--color-line)]">
        <span className="text-2xl leading-none">{icon}</span>
        <div>
          <h2 className="font-display text-xl">{title}</h2>
          <p className="text-xs text-[var(--color-ink-soft)] italic mt-0.5">
            {subtitle}
          </p>
        </div>
      </header>
      {children}
    </section>
  )
}

function StatusMessage({
  type,
  text,
}: {
  type: 'ok' | 'err' | 'info'
  text: string
}) {
  const colors = {
    ok: 'text-[var(--color-ink-soft)] bg-[var(--color-paper)]',
    err: 'text-[var(--color-accent)] bg-[var(--color-paper)]',
    info: 'text-[var(--color-ink-soft)] bg-[var(--color-paper)]',
  }
  return <div className={`text-xs px-3 py-2 rounded ${colors[type]}`}>{text}</div>
}

// ─────────────────────────────────────────────────────────────
// 기념일 카드
// ─────────────────────────────────────────────────────────────
function BirthdaysCard() {
  const [upcoming, setUpcoming] = useState<UpcomingBirthday[]>([])
  const [count, setCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getUpcomingBirthdays(30).then(setUpcoming)
  }, [])

  async function exportIcs() {
    setError(null)
    try {
      const { ics, count } = await generateBirthdaysIcal()
      if (count === 0) {
        setError('생일이 등록된 사람이 없어요. People 페이지에서 추가해주세요.')
        return
      }
      downloadFile(ics, 'birthdays.ics', 'text/calendar')
      setCount(count)
    } catch (e) {
      setError(e instanceof Error ? e.message : '실패')
    }
  }

  return (
    <Card icon="🎂" title="기념일 리마인더" subtitle="생일을 캘린더에 동기화">
      {upcoming.length > 0 ? (
        <div className="mb-5 text-sm">
          <div className="text-xs text-[var(--color-ink-soft)] uppercase tracking-wide mb-2">
            다가오는 30일
          </div>
          <div className="space-y-1.5">
            {upcoming.map(({ person, daysUntil }) => (
              <div
                key={person.id}
                className="flex justify-between items-center py-1"
              >
                <span>{person.name}</span>
                <span className="text-[var(--color-ink-soft)] text-xs tabular-nums">
                  {daysUntil === 0
                    ? '오늘 🎉'
                    : daysUntil === 1
                      ? '내일'
                      : `${daysUntil}일 후`}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-[var(--color-ink-soft)] mb-5">
          앞으로 30일 안에 다가오는 생일이 없어요.
        </p>
      )}

      <p className="text-xs text-[var(--color-ink-soft)] mb-4 leading-relaxed">
        등록된 모든 생일을 매년 반복되는 .ics 파일로 받아 Google / Apple 캘린더에
        import. 생일 3일 전 자동 알림 포함.
      </p>

      <button onClick={exportIcs} className="btn-primary w-full">
        birthdays.ics 다운로드
      </button>

      {count > 0 && (
        <div className="mt-3">
          <StatusMessage type="ok" text={`✓ ${count}개 생일 export 됨`} />
        </div>
      )}
      {error && (
        <div className="mt-3">
          <StatusMessage type="err" text={error} />
        </div>
      )}
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────
// 백업/복원 카드
// ─────────────────────────────────────────────────────────────
function BackupCard() {
  const [exportPwd, setExportPwd] = useState('')
  const [importPwd, setImportPwd] = useState('')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null,
  )

  async function doExport() {
    if (!exportPwd) {
      setMessage({ type: 'err', text: '비밀번호를 입력하세요.' })
      return
    }
    if (exportPwd.length < 8) {
      setMessage({ type: 'err', text: '비밀번호는 8자 이상이어야 해요.' })
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      const encrypted = await exportBackup(exportPwd)
      const date = new Date().toISOString().slice(0, 10)
      downloadFile(encrypted, `diary-backup-${date}.json.enc`, 'application/json')
      setMessage({
        type: 'ok',
        text: '✓ 백업 다운로드 완료. 비밀번호 잊지 마세요!',
      })
      setExportPwd('')
    } catch (e) {
      setMessage({ type: 'err', text: e instanceof Error ? e.message : '실패' })
    } finally {
      setBusy(false)
    }
  }

  async function doImport() {
    if (!importFile || !importPwd) {
      setMessage({ type: 'err', text: '파일과 비밀번호를 모두 입력하세요.' })
      return
    }
    if (
      !confirm(
        '⚠️ 복원하면 현재 모든 데이터(사람, facts, episodes, 메시지)가 백업으로 덮어쓰여져요.\n계속할까요?',
      )
    )
      return

    setBusy(true)
    setMessage(null)
    try {
      const text = await importFile.text()
      const result: RestoreResult = await restoreBackup(text, importPwd)
      setMessage({
        type: 'ok',
        text: `✓ 복원 완료 (${result.exportedAt.toLocaleDateString('ko-KR')} 백업): 사람 ${result.people}, facts ${result.facts}, episodes ${result.episodes}, 메시지 ${result.messages}`,
      })
      setImportFile(null)
      setImportPwd('')
    } catch (e) {
      setMessage({ type: 'err', text: e instanceof Error ? e.message : '실패' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card icon="🔒" title="백업 / 복원" subtitle="암호화된 파일로 데이터 보호">
      <div className="space-y-6">
        {/* Export */}
        <div>
          <h3 className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)] mb-3">
            내보내기
          </h3>
          <div className="space-y-3">
            <input
              type="password"
              value={exportPwd}
              onChange={(e) => setExportPwd(e.target.value)}
              placeholder="비밀번호 (8자 이상)"
              className="input"
              disabled={busy}
            />
            <button
              onClick={doExport}
              disabled={busy || !exportPwd}
              className="btn-primary w-full"
            >
              암호화된 백업 다운로드
            </button>
          </div>
        </div>

        <div className="border-t border-[var(--color-line)]" />

        {/* Import */}
        <div>
          <h3 className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)] mb-3">
            복원
          </h3>
          <div className="space-y-3">
            <FileDropZone
              accept=".enc,.json"
              file={importFile}
              onFile={setImportFile}
              hint="백업 파일 선택"
              disabled={busy}
            />
            <input
              type="password"
              value={importPwd}
              onChange={(e) => setImportPwd(e.target.value)}
              placeholder="비밀번호"
              className="input"
              disabled={busy}
            />
            <button
              onClick={doImport}
              disabled={busy || !importFile || !importPwd}
              className="btn-secondary w-full"
            >
              복원 (현재 데이터 덮어씀)
            </button>
          </div>
        </div>

        {message && <StatusMessage type={message.type} text={message.text} />}

        <p className="text-xs text-[var(--color-ink-soft)] leading-relaxed">
          PBKDF2 (100K iter) + AES-GCM 암호화. 비밀번호는 복호화에만 쓰이고 저장되지
          않아요. 잊으면 영구 복구 불가.
        </p>
      </div>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────
// 카톡 import 카드
// ─────────────────────────────────────────────────────────────
function KakaoImportCard() {
  const [people, setPeople] = useState<Person[]>([])
  const [personId, setPersonId] = useState<number | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [chunks, setChunks] = useState<DailyChunk[] | null>(null)
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [result, setResult] = useState<{
    episodes: number
    facts: number
    failed: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)

  useEffect(() => {
    db.people.toArray().then(setPeople)
  }, [])

  function reset() {
    setFile(null)
    setChunks(null)
    setProgress(null)
    setResult(null)
    setError(null)
  }

  function handleFile(f: File | null) {
    setFile(f)
    setChunks(null)
    setError(null)
    setResult(null)
  }

  async function previewFile() {
    if (!file) return
    setError(null)
    setAnalyzing(true)
    try {
      const text = await readKakaoFile(file)
      const messages = parseKakaoExport(text)
      if (messages.length === 0) {
        setError(
          '메시지를 추출하지 못했어요. 카카오톡 모바일/PC 대화 내보내기 형식이 맞나요?',
        )
        return
      }
      setChunks(groupByDay(messages))
    } catch (e) {
      setError(e instanceof Error ? e.message : '파일 읽기 실패')
    } finally {
      setAnalyzing(false)
    }
  }

  async function startImport() {
    if (!chunks || personId === null) return
    const person = people.find((p) => p.id === personId)
    if (!person) return

    setProgress({ phase: 'parsing', current: 0, total: chunks.length })
    setError(null)

    try {
      const summary = await importChunks(chunks, personId, person.name, setProgress)
      setResult(summary)
      setChunks(null)
      setFile(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'import 실패')
    } finally {
      setTimeout(() => setProgress(null), 1500)
    }
  }

  const allSenders = chunks
    ? Array.from(new Set(chunks.flatMap((c) => c.senders)))
    : []

  return (
    <Card icon="💬" title="카카오톡 가져오기" subtitle="대화 export로 기억 한꺼번에 채우기">
      {!progress && !result && (
        <div className="space-y-4">
          <p className="text-xs text-[var(--color-ink-soft)] leading-relaxed">
            카카오톡 → 채팅방 → 메뉴 → 대화 내보내기. 대화는 일별로 묶여 episode로
            저장돼.
            <br />
            지원 형식:{' '}
            <code className="text-[var(--color-ink)] bg-[var(--color-paper)] px-1 rounded">
              .txt
            </code>
            {' (직접 export)'}
            <code className="text-[var(--color-ink)] bg-[var(--color-paper)] px-1 rounded ml-1">
              .eml
            </code>
            {' (이메일로 받은 export)'}
          </p>

          <div>
            <label className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)] block mb-2">
              누구와의 대화인가요
            </label>
            <select
              value={personId ?? ''}
              onChange={(e) =>
                setPersonId(e.target.value ? Number(e.target.value) : null)
              }
              className="input"
            >
              <option value="">— 사람 선택 —</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {people.length === 0 && (
              <p className="text-xs text-[var(--color-accent)] mt-2">
                먼저 People 페이지에서 사람을 등록해주세요.
              </p>
            )}
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-[var(--color-ink-soft)] block mb-2">
              파일
            </label>
            <FileDropZone
              accept=".txt,.eml"
              file={file}
              onFile={handleFile}
              hint="카카오톡 대화 파일"
            />
          </div>

          {file && !chunks && (
            <button
              onClick={previewFile}
              disabled={!personId || analyzing}
              className="btn-secondary w-full"
            >
              {analyzing ? '분석 중...' : '파일 분석'}
            </button>
          )}

          {chunks && (
            <div className="border border-[var(--color-line)] rounded-lg p-4 space-y-2 bg-[var(--color-paper)]">
              <div className="text-sm">
                ✓ <strong>{chunks.length}일</strong>치 대화,{' '}
                <strong>{chunks.reduce((s, c) => s + c.messageCount, 0)}</strong>개
                메시지
              </div>
              <div className="text-xs text-[var(--color-ink-soft)]">
                참여자: {allSenders.join(', ')}
              </div>
              <div className="text-xs text-[var(--color-ink-soft)]">
                예상 시간: 약 {Math.ceil((chunks.length * 1.5) / 60) || 1}분
              </div>
              <button onClick={startImport} className="btn-primary w-full mt-2">
                가져오기 시작
              </button>
            </div>
          )}

          {error && <StatusMessage type="err" text={error} />}
        </div>
      )}

      {progress && (
        <div className="py-4 space-y-3">
          <div className="text-sm flex justify-between">
            <span>
              {progress.phase === 'embedding' && '의미 임베딩 중...'}
              {progress.phase === 'extracting' && 'fact 추출 중...'}
              {progress.phase === 'done' && '완료'}
            </span>
            <span className="text-[var(--color-ink-soft)] tabular-nums">
              {progress.current} / {progress.total}
            </span>
          </div>
          <div className="w-full h-1 bg-[var(--color-line)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--color-ink)] transition-all"
              style={{
                width: `${(progress.current / progress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="text-sm space-y-1">
            <div>✓ Episode {result.episodes}개 저장</div>
            <div>✓ Fact {result.facts}개 추가/갱신</div>
            {result.failed > 0 && (
              <div className="text-[var(--color-accent)]">
                ⚠ {result.failed}개 실패
              </div>
            )}
          </div>
          <button onClick={reset} className="btn-secondary w-full">
            다시 가져오기
          </button>
        </div>
      )}
    </Card>
  )
}
