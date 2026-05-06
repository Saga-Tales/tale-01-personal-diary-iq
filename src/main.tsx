import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
)

// Service worker 등록 (PWA — 오프라인 사용 + 홈 화면 추가)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swPath = `${import.meta.env.BASE_URL}sw.js`
    navigator.serviceWorker
      .register(swPath)
      .then((reg) => {
        console.log('[sw] 등록됨, scope:', reg.scope)
      })
      .catch((err) => {
        console.warn('[sw] 등록 실패:', err)
      })
  })
}
