import { MessageSquare, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChatSummary } from '../api/types'
import { useChatStore } from '../store/chat'

function dateGroup(updatedAt: string): string {
  const d = new Date(updatedAt)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (d >= startOfToday) return 'Today'
  if (d >= new Date(startOfToday.getTime() - 86400000)) return 'Yesterday'
  if (d >= new Date(startOfToday.getTime() - 7 * 86400000)) return 'Previous 7 days'
  if (d >= new Date(startOfToday.getTime() - 30 * 86400000)) return 'Previous 30 days'
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export default function Sidebar({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const chats = useChatStore((s) => s.chats)
  const activeChatId = useChatStore((s) => s.activeChatId)
  const loadChats = useChatStore((s) => s.loadChats)
  const openChat = useChatStore((s) => s.openChat)
  const newChat = useChatStore((s) => s.newChat)
  const deleteChat = useChatStore((s) => s.deleteChat)
  const renameChat = useChatStore((s) => s.renameChat)

  const [query, setQuery] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadChats(query).catch(() => undefined)
  }, [query, loadChats])

  const groups = useMemo(() => {
    const map = new Map<string, ChatSummary[]>()
    for (const c of [...chats].sort((a, b) => b.updated_at.localeCompare(a.updated_at))) {
      const key = dateGroup(c.updated_at)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(c)
    }
    return Array.from(map.entries())
  }, [chats])

  const startRename = (chat: ChatSummary) => {
    setRenamingId(chat.id)
    setRenameValue(chat.title)
    setTimeout(() => renameInputRef.current?.select(), 0)
  }

  const commitRename = async () => {
    if (renamingId && renameValue.trim()) {
      await renameChat(renamingId, renameValue.trim())
    }
    setRenamingId(null)
  }

  return (
    <>
      {/* mobile backdrop */}
      <div
        className={`fixed inset-0 z-30 bg-black/40 md:hidden ${open ? '' : 'hidden'}`}
        onClick={onClose}
      />
      <aside
        className={`fixed md:static z-40 inset-y-0 left-0 w-72 shrink-0 transform border-r border-zinc-200 dark:border-zinc-800
                    bg-zinc-50 dark:bg-zinc-900 flex flex-col transition-transform duration-200
                    ${open ? 'translate-x-0' : '-translate-x-full md:hidden'}`}
      >
        <div className="flex items-center justify-between p-3">
          <button
            onClick={() => {
              newChat()
              onClose()
            }}
            className="flex flex-1 items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800
                       px-3 py-2 text-sm font-medium shadow-sm hover:bg-brand-50 dark:hover:bg-zinc-700 transition"
          >
            <Plus size={16} className="text-brand-500" /> New chat
          </button>
          <button
            onClick={onClose}
            className="ml-2 p-2 rounded-lg text-zinc-500 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 md:hidden"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-3 pb-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chats..."
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800
                         pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 ring-brand-300/60 placeholder:text-zinc-400"
            />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          {groups.length === 0 && (
            <p className="px-4 py-6 text-sm text-zinc-400">No conversations yet.</p>
          )}
          {groups.map(([label, items]) => (
            <div key={label} className="mb-2">
              <p className="px-2 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                {label}
              </p>
              <ul className="space-y-0.5">
                {items.map((chat) => (
                  <li key={chat.id} className="group relative">
                    {renamingId === chat.id ? (
                      <input
                        ref={renameInputRef}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename()
                          if (e.key === 'Escape') setRenamingId(null)
                        }}
                        className="w-full rounded-lg border border-brand-400 bg-white dark:bg-zinc-800 px-3 py-2 text-sm outline-none"
                        autoFocus
                      />
                    ) : (
                      <button
                        onClick={() => {
                          openChat(chat.id)
                          onClose()
                        }}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 pr-14 text-left text-sm truncate transition-colors
                          ${
                            activeChatId === chat.id
                              ? 'bg-brand-100/80 dark:bg-brand-500/15 text-brand-800 dark:text-brand-200 font-medium'
                              : 'hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
                          }`}
                        title={chat.title}
                      >
                        <MessageSquare size={15} className="shrink-0 opacity-60" />
                        <span className="truncate">{chat.title}</span>
                      </button>
                    )}

                    {renamingId !== chat.id && (
                      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            startRename(chat)
                          }}
                          className="p-1.5 rounded-md text-zinc-500 hover:text-brand-600 hover:bg-white dark:hover:bg-zinc-700"
                          title="Rename"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteChat(chat.id)
                          }}
                          className="p-1.5 rounded-md text-zinc-500 hover:text-red-600 hover:bg-white dark:hover:bg-zinc-700"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  )
}
