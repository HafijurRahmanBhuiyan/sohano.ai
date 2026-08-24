import { create } from 'zustand'
import {
  apiCreateChat,
  apiDeleteChat,
  apiGetChat,
  apiListChats,
  apiRenameChat,
  streamChat,
} from '../api/client'
import type { Attachment, ChatSummary, Message } from '../api/types'

export type ThinkingStatus = 'idle' | 'thinking' | 'caught'

interface ChatState {
  chats: ChatSummary[]
  activeChatId: string | null
  messages: Message[]
  streamingText: string | null
  status: ThinkingStatus
  loadingChat: boolean

  loadChats: (query?: string) => Promise<void>
  openChat: (id: string) => Promise<void>
  newChat: () => void
  deleteChat: (id: string) => Promise<void>
  renameChat: (id: string, title: string) => Promise<void>
  send: (content: string, attachments?: Attachment[]) => Promise<void>
  regenerate: () => Promise<void>
  stop: () => void
}

let abortController: AbortController | null = null
let caughtTimer: ReturnType<typeof setTimeout> | null = null

function markCaught() {
  useChatStore.setState({ status: 'caught' })
  if (caughtTimer) clearTimeout(caughtTimer)
  caughtTimer = setTimeout(() => useChatStore.setState({ status: 'idle' }), 2600)
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  activeChatId: null,
  messages: [],
  streamingText: null,
  status: 'idle',
  loadingChat: false,

  loadChats: async (query = '') => {
    const chats = await apiListChats(query)
    set({ chats })
  },

  openChat: async (id) => {
    if (get().activeChatId === id) return
    set({ activeChatId: id, messages: [], streamingText: null, loadingChat: true })
    try {
      const chat = await apiGetChat(id)
      set({ messages: chat.messages, loadingChat: false })
    } catch {
      set({ activeChatId: null, loadingChat: false })
    }
  },

  newChat: () => set({ activeChatId: null, messages: [], streamingText: null }),

  deleteChat: async (id) => {
    await apiDeleteChat(id)
    const { activeChatId } = get()
    set((s) => ({ chats: s.chats.filter((c) => c.id !== id) }))
    if (activeChatId === id) set({ activeChatId: null, messages: [] })
  },

  renameChat: async (id, title) => {
    const updated = await apiRenameChat(id, title)
    set((s) => ({ chats: s.chats.map((c) => (c.id === id ? updated : c)) }))
  },

  send: async (content, attachments = []) => {
    let chatId = get().activeChatId
    if (!chatId) {
      const chat = await apiCreateChat()
      chatId = chat.id
      set((s) => ({ activeChatId: chatId, chats: [chat, ...s.chats] }))
    }

    const optimisticUserMsg: Message = {
      id: `tmp-${Date.now()}`,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
      attachments,
    }
    set((s) => ({
      messages: [...s.messages, optimisticUserMsg],
      streamingText: '',
      status: 'thinking',
    }))

    await runStream(chatId, { content })
  },

  regenerate: async () => {
    const chatId = get().activeChatId
    if (!chatId) return
    set({ streamingText: '', status: 'thinking' })
    await runStream(chatId, { regenerate: true })
  },

  stop: () => {
    abortController?.abort()
    abortController = null
  },
}))

async function runStream(chatId: string, payload: { content?: string; regenerate?: boolean }) {
  const state = useChatStore.getState()

  if (payload.regenerate) {
    // drop trailing assistant bubble locally before re-asking
    const msgs = [...state.messages]
    while (msgs.length && msgs[msgs.length - 1].role === 'assistant') msgs.pop()
    useChatStore.setState({ messages: msgs })
  }

  abortController = new AbortController()

  try {
    await streamChat(
      chatId,
      payload,
      ({ event, data }) => {
        const s = useChatStore.getState()
        if (event === 'delta') {
          useChatStore.setState({
            streamingText: (s.streamingText ?? '') + String(data.text ?? ''),
          })
        } else if (event === 'done') {
          const msg = data.message as Message
          const titleUpdated = Boolean(data.title_updated) || Boolean(data.title)
          useChatStore.setState({
            messages: [...s.messages, msg],
            streamingText: null,
            status: 'caught',
          })
          if (titleUpdated) {
            useChatStore.setState((st) => ({
              chats: st.chats.map((c) =>
                c.id === chatId ? { ...c, title: String(data.title) } : c,
              ),
            }))
          }
          markCaught()
        } else if (event === 'error') {
          useChatStore.setState({
            streamingText:
              String(data.detail ?? '') +
              '\n\nPlease try again in a moment.',
          })
        }
      },
      )
    const s = useChatStore.getState()
    if (s.status === 'thinking') markCaught()
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      // User pressed stop: the backend still finishes and saves — resync shortly.
      setTimeout(() => {
        const id = useChatStore.getState().activeChatId
        if (id) {
          apiGetChat(id)
            .then((c) => useChatStore.setState({ messages: c.messages }))
            .catch(() => undefined)
        }
      }, 1200)
    } else if (!useChatStore.getState().streamingText) {
      useChatStore.setState({
        streamingText:
          "Sorry — Sohano.ai couldn't reach the AI service. Please check your connection and try again.",
      })
    }
    markCaught()
  } finally {
    useChatStore.setState({ streamingText: null })
    abortController = null
    useChatStore.getState().loadChats().catch(() => undefined)
  }
}
