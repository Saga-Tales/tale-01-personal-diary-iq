import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
  }

  reset = () => this.setState({ error: null })

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen p-8 max-w-xl mx-auto">
          <h1 className="text-2xl font-display mb-4">앱에서 에러가 발생했어</h1>
          <p className="text-[var(--color-ink-soft)] mb-4 leading-relaxed">
            DevTools 콘솔(F12 → Console)에서 자세한 스택트레이스 확인 가능.
            아래는 메시지만:
          </p>
          <pre className="bg-[var(--color-surface)] border border-[var(--color-line)] p-3 rounded text-xs overflow-auto whitespace-pre-wrap">
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <button
            onClick={this.reset}
            className="mt-6 btn-primary"
          >
            다시 시도
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
