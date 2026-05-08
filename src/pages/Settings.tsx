import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getApiKey, setApiKey, clearApiKey } from '@/lib/anthropic'
import { InstallHint } from '@/components/InstallHint'
import { ThemeToggle } from '@/components/ThemeToggle'
import {
  computeStorage,
  formatBytes,
  daysSinceBackup,
  type StorageInfo,
} from '@/lib/diary-state'

export function Settings() {
  const [apiKey, setKey] = useState('')
  const [saved, setSaved] = useState(false)
  const [storage, setStorage] = useState<StorageInfo | null>(null)
  const [backupDays, setBackupDays] = useState<number | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    setKey(getApiKey() || '')
    computeStorage().then(setStorage)
    setBackupDays(daysSinceBackup())
  }, [])

  function save() {
    if (!apiKey.trim()) return
    setApiKey(apiKey.trim())
    setSaved(true)
    setTimeout(() => navigate('/'), 600)
  }

  function clear() {
    clearApiKey()
    setKey('')
    setSaved(false)
  }

  return (
    <div className="max-w-xl mx-auto p-6 sm:p-8 space-y-8">
      <header className="ink-in">
        <div className="text-[var(--color-gold)] text-sm mb-2">✦</div>
        <h1 className="font-display italic text-4xl text-[var(--color-ink-warm)] leading-tight">
          설정
        </h1>
        <p className="text-[var(--color-ink-soft)] italic font-display mt-1.5">
          너의 키, 너의 데이터, 너의 일기.
        </p>
        <div className="mt-4 h-px bg-gradient-to-r from-[var(--color-gold)] via-[var(--color-line)] to-transparent" />
      </header>

      {/* API Key */}
      <section className="card-ruled p-5 sm:p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2 text-[var(--color-ink-warm)]">
            Anthropic API 키
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-ant-..."
            className="w-full border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink-warm)] rounded-lg px-3 py-2.5 font-mono text-sm focus:outline-none focus:border-[var(--color-ink-warm)] focus:ring-2 focus:ring-[var(--color-gold)]/20 transition-shadow"
            style={{ boxShadow: 'var(--shadow-press)' }}
          />
          <p className="text-xs text-[var(--color-ink-soft)] mt-2.5 leading-relaxed">
            console.anthropic.com에서 발급받은 키를 입력해.<br />
            이 키는 너의 브라우저에만 저장되고, 외부 서버로 전송되지 않아.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={!apiKey.trim()}
            className="btn-primary"
          >
            {saved ? '저장됨 ✓' : '저장하기'}
          </button>
          <button
            onClick={clear}
            className="btn-secondary"
          >
            지우기
          </button>
        </div>
      </section>

      {/* 외관 */}
      <section className="card-ruled p-5 sm:p-6">
        <header className="mb-4 flex items-baseline gap-2">
          <span className="text-[var(--color-gold)] text-sm leading-none">✦</span>
          <h2 className="font-display italic text-lg text-[var(--color-ink-warm)]">외관</h2>
        </header>
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-[var(--color-ink-soft)] leading-relaxed">
            낮엔 종이, 밤엔 가죽. 시스템 설정 따라가거나 직접 골라.
          </p>
          <ThemeToggle variant="segmented" />
        </div>
      </section>

      {/* 데이터 현황 — 신뢰 가시화 */}
      <section className="card-ruled p-5 sm:p-6">
        <header className="mb-4 flex items-baseline gap-2">
          <span className="text-[var(--color-gold)] text-sm leading-none">✦</span>
          <h2 className="font-display italic text-lg text-[var(--color-ink-warm)]">데이터 현황</h2>
          <span className="eyebrow ml-auto">너의 기기에만</span>
        </header>
        {storage ? (
          <div className="space-y-3 text-sm">
            <DataRow label="사람" value={storage.peopleCount.toLocaleString()} />
            <DataRow label="알게 된 것 (facts)" value={storage.factCount.toLocaleString()} />
            <DataRow label="일화 (episodes)" value={storage.episodeCount.toLocaleString()} />
            <DataRow label="메시지" value={storage.messageCount.toLocaleString()} />
            {storage.estimatedBytes !== null && (
              <DataRow
                label="저장 공간 사용량"
                value={
                  storage.quotaBytes
                    ? `${formatBytes(storage.estimatedBytes)} / ${formatBytes(storage.quotaBytes)}`
                    : formatBytes(storage.estimatedBytes)
                }
              />
            )}
            <DataRow
              label="마지막 백업"
              value={
                backupDays === null
                  ? <span className="text-[var(--color-accent)]">아직 없음 — 데이터 페이지에서 받아두자</span>
                  : backupDays === 0
                    ? '오늘'
                    : backupDays === 1
                      ? '어제'
                      : (
                          <span className={backupDays >= 30 ? 'text-[var(--color-accent)]' : ''}>
                            {backupDays}일 전
                          </span>
                        )
              }
            />
          </div>
        ) : (
          <p className="text-xs text-[var(--color-ink-soft)] italic">현황 계산 중...</p>
        )}
      </section>

      {/* PWA install */}
      <InstallHint />
    </div>
  )
}

function DataRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-[var(--color-line)] pb-2 last:border-0 last:pb-0">
      <span className="text-[var(--color-ink-soft)]">{label}</span>
      <span className="numeral text-[var(--color-ink-warm)] tabular-nums">{value}</span>
    </div>
  )
}
