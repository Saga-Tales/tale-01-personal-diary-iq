import { useState, useRef } from 'react'

interface Props {
  accept: string
  file: File | null
  onFile: (file: File | null) => void
  hint?: string
  disabled?: boolean
}

export function FileDropZone({ accept, file, onFile, hint, disabled }: Props) {
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (disabled) return
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) onFile(dropped)
  }

  function handleClear(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    onFile(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const stateClasses = file
    ? 'border-[var(--color-gold)] bg-[var(--color-surface)]'
    : dragOver
      ? 'border-[var(--color-accent)] bg-[var(--color-paper-warm)]'
      : 'border-[var(--color-line)] hover:border-[var(--color-gold)] bg-[var(--color-surface-mute)]'

  return (
    <label
      className={`block border-2 border-dashed rounded-xl p-6 cursor-pointer transition-all ${stateClasses} ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      }`}
      style={file || dragOver ? { boxShadow: 'var(--shadow-soft)' } : undefined}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={(e) => onFile(e.target.files?.[0] || null)}
        className="sr-only"
        disabled={disabled}
      />
      {file ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <FileIcon />
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{file.name}</div>
              <div className="text-xs text-[var(--color-ink-soft)]">
                {formatSize(file.size)}
              </div>
            </div>
          </div>
          <button
            onClick={handleClear}
            className="text-[var(--color-ink-soft)] hover:text-[var(--color-accent)] text-sm px-2 py-1"
            disabled={disabled}
            aria-label="파일 제거"
          >
            ✕
          </button>
        </div>
      ) : (
        <div className="text-center space-y-2">
          <div className={dragOver ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink-soft)]'}>
            <UploadIcon />
          </div>
          <div className="text-sm font-display italic text-[var(--color-ink-warm)]">
            {hint ?? '파일 선택 또는 끌어다 놓기'}
          </div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink-soft)]">
            {accept.replace(/\./g, '').replace(/,/g, ' · ').toUpperCase()}
          </div>
        </div>
      )}
    </label>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function UploadIcon() {
  return (
    <svg
      className="mx-auto opacity-50"
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="flex-shrink-0"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}
