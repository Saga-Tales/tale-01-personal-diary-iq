import { Routes, Route, NavLink, Link } from 'react-router-dom'
import { ApiKeyGate } from '@/components/ApiKeyGate'
import { Settings } from '@/pages/Settings'
import { People } from '@/pages/People'
import { Chat } from '@/pages/Chat'
import { Data } from '@/pages/Data'
import { Digest } from '@/pages/Digest'
import { Home } from '@/pages/Home'

export default function App() {
  return (
    <div className="min-h-screen">
      <Nav />
      <Routes>
        <Route path="/" element={<ApiKeyGate><Home /></ApiKeyGate>} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/people" element={<ApiKeyGate><People /></ApiKeyGate>} />
        <Route path="/chat" element={<ApiKeyGate><Chat /></ApiKeyGate>} />
        <Route path="/digest" element={<ApiKeyGate><Digest /></ApiKeyGate>} />
        <Route path="/data" element={<ApiKeyGate><Data /></ApiKeyGate>} />
      </Routes>
    </div>
  )
}

function Nav() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 sm:px-4 py-3 text-sm transition-colors ${
      isActive
        ? 'text-[var(--color-ink)] font-medium'
        : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
    }`

  return (
    <nav className="border-b border-[var(--color-line)] flex items-center pl-5 sm:pl-7 pr-2">
      <Link
        to="/"
        className="font-display text-2xl italic py-3 select-none no-underline text-[var(--color-ink)] hover:opacity-70 transition-opacity"
      >
        diary
      </Link>
      <div className="flex-1" />
      <NavLink to="/chat" className={linkClass}>대화</NavLink>
      <NavLink to="/people" className={linkClass}>사람들</NavLink>
      <NavLink to="/digest" className={linkClass}>다이제스트</NavLink>
      <NavLink to="/data" className={linkClass}>데이터</NavLink>
      <NavLink to="/settings" className={linkClass}>설정</NavLink>
    </nav>
  )
}
