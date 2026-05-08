import { Routes, Route, NavLink, Link } from 'react-router-dom'
import { ApiKeyGate } from '@/components/ApiKeyGate'
import { ThemeToggle } from '@/components/ThemeToggle'
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
    `relative px-3 sm:px-4 py-3 text-sm transition-colors ${
      isActive
        ? 'text-[var(--color-ink)] font-medium'
        : 'text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]'
    }`

  return (
    <nav
      className="sticky top-0 z-30 backdrop-blur-md bg-[var(--color-paper)]/80 border-b border-[var(--color-line)] flex items-center pl-5 sm:pl-7 pr-2"
      style={{ boxShadow: '0 1px 0 rgb(255 255 255 / 0.5) inset' }}
    >
      <Link
        to="/"
        className="group font-display text-2xl italic py-3 select-none no-underline text-[var(--color-ink)] hover:opacity-80 transition-opacity inline-flex items-baseline gap-1.5"
      >
        <span>diary</span>
        <span className="w-1 h-1 rounded-full bg-[var(--color-accent)] inline-block translate-y-[-1px] group-hover:bg-[var(--color-gold)] transition-colors" />
      </Link>
      <div className="flex-1" />
      {[
        { to: '/chat', label: '대화' },
        { to: '/people', label: '사람들' },
        { to: '/digest', label: '다이제스트' },
        { to: '/data', label: '데이터' },
        { to: '/settings', label: '설정' },
      ].map((item) => (
        <NavLink key={item.to} to={item.to} className={linkClass}>
          {({ isActive }) => (
            <>
              {item.label}
              {isActive && (
                <span
                  aria-hidden
                  className="absolute left-1/2 -translate-x-1/2 bottom-1.5 w-1 h-1 rounded-full bg-[var(--color-gold)]"
                />
              )}
            </>
          )}
        </NavLink>
      ))}
      <span aria-hidden className="mx-1 sm:mx-2 w-px h-4 bg-[var(--color-line)]" />
      <ThemeToggle />
    </nav>
  )
}
