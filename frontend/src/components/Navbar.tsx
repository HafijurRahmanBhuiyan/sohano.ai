import { LogOut, PanelLeft, Settings } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import { useChatStore } from '../store/chat'
import ThinkingIndicator from './ThinkingIndicator'
import ThemeToggle from './ThemeToggle'

export default function Navbar({ onToggleSidebar }: { onToggleSidebar: () => void }) {
  const status = useChatStore((s) => s.status)
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur px-3">
      <button
        onClick={onToggleSidebar}
        className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
        title="Toggle sidebar"
        aria-label="Toggle sidebar"
      >
        <PanelLeft size={18} />
      </button>

      {/* Logo */}
      <Link to="/" className="flex items-center gap-1.5 font-semibold text-[15px] tracking-tight">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500 text-white text-sm shadow-sm">
          S
        </span>
        <span>
          Sohano<span className="text-brand-500">.ai</span>
        </span>
      </Link>

      {/* Signature cat-vs-mouse thinking animation */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <ThinkingIndicator status={status} />
      </div>

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />

        <div className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            onBlur={() => setTimeout(() => setMenuOpen(false), 150)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-700/40
                       text-brand-700 dark:text-brand-300 font-semibold text-sm hover:ring-2 ring-brand-300 transition"
            title={user?.name}
          >
            {(user?.name ?? '?').slice(0, 1).toUpperCase()}
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800
                         bg-white dark:bg-zinc-900 shadow-lg py-1"
            >
              <div className="px-4 py-2 border-b border-zinc-100 dark:border-zinc-800">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
              </div>
              <Link
                to="/settings"
                className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800/70"
              >
                <Settings size={15} /> Settings
              </Link>
              <button
                onClick={logout}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
              >
                <LogOut size={15} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
