import { useTheme, type Theme } from '@/lib/theme'

const LABELS: Record<Theme, string> = {
  system: '시스템',
  light: '낮',
  dark: '밤',
}

export function ThemeToggle({ variant = 'icon' }: { variant?: 'icon' | 'segmented' }) {
  const { theme, setTheme, cycle, resolved } = useTheme()

  if (variant === 'segmented') {
    return (
      <div className="flex border border-[var(--color-line)] rounded-lg p-1 text-xs bg-[var(--color-paper-warm)]/40 w-fit">
        {(['system', 'light', 'dark'] as Theme[]).map((t) => (
          <button
            key={t}
            onClick={() => setTheme(t)}
            className={`px-3 py-1.5 rounded-md transition-all ${
              theme === t
                ? 'bg-[var(--color-surface)] text-[var(--color-ink-warm)] font-medium'
                : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink-warm)]'
            }`}
            style={theme === t ? { boxShadow: 'var(--shadow-soft)' } : undefined}
          >
            {LABELS[t]}
          </button>
        ))}
      </div>
    )
  }

  return (
    <button
      onClick={cycle}
      aria-label={`테마 전환 (현재: ${LABELS[theme]})`}
      title={`테마: ${LABELS[theme]} (클릭해서 전환)`}
      className="px-2 py-3 text-[var(--color-ink-soft)] hover:text-[var(--color-ink-warm)] transition-colors"
    >
      {resolved === 'dark' ? <MoonIcon /> : <SunIcon />}
    </button>
  )
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  )
}
