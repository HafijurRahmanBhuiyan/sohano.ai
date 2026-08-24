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
import { DEFAULT_MODEL_ID, loadSavedModel, saveModel } from '../config/models'

export type ThinkingStatus = 'idle' | 'thinking' | 'caught'

interface ChatState {
  chats: ChatSummary[]
  activeChatId: string | null
  messages: Message[]
  streamingText: string | null
  status: ThinkingStatus
  loadingChat: boolean
  selectedModel: string

  loadChats: (query?: string) => Promise<void>
  openChat: (id: string) => Promise<void>
  newChat: () => void
  deleteChat: (id: string) => Promise<void>
  renameChat: (id: string, title: string) => Promise<void>
  send: (content: string, attachments?: Attachment[]) => Promise<void>
  regenerate: () => Promise<void>
  stop: () => void
  setSelectedModel: (id: string) => void
}

let abortController: AbortController | null = null
let caughtTimer: ReturnType<typeof setTimeout> | null = null

function markCaught() {
  useChatStore.setState({ status: 'caught' })

  if (caughtTimer) {
    clearTimeout(caughtTimer)
  }

  caughtTimer = setTimeout(() => {
    useChatStore.setState({ status: 'idle' })
  }, 2600)
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  activeChatId: null,
  messages: [],
  streamingText: null,
  status: 'idle',
  loadingChat: false,
  selectedModel: loadSavedModel(),

  setSelectedModel: (id) => {
    saveModel(id)
    useChatStore.setState({ selectedModel: id })
  },

  loadChats: async (query = '') => {
    const chats = await apiListChats(query)
    set({ chats })
  },

  openChat: async (id) => {
    if (get().activeChatId === id) return

    set({
      activeChatId: id,
      messages: [],
      streamingText: null,
      loadingChat: true,
    })

    try {
      const chat = await apiGetChat(id)

      set({
        messages: chat.messages,
        loadingChat: false,
      })
    } catch {
      set({
        activeChatId: null,
        messages: [],
        loadingChat: false,
      })
    }
  },

  newChat: () => {
    abortController?.abort()
    abortController = null

    set({
      activeChatId: null,
      messages: [],
      streamingText: null,
      status: 'idle',
      loadingChat: false,
    })
  },

  deleteChat: async (id) => {
    await apiDeleteChat(id)

    const { activeChatId } = get()

    set((state) => ({
      chats: state.chats.filter((chat) => chat.id !== id),
    }))

    if (activeChatId === id) {
      set({
        activeChatId: null,
        messages: [],
        streamingText: null,
      })
    }
  },

  renameChat: async (id, title) => {
    const updated = await apiRenameChat(id, title)

    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === id ? updated : chat,
      ),
    }))
  },

  send: async (content, attachments = []) => {
    let chatId = get().activeChatId

    // No active chat: create one first.
    if (!chatId) {
      const chat = await apiCreateChat()

      chatId = chat.id

      set((state) => ({
        activeChatId: chatId,
        chats: [chat, ...state.chats],
      }))
    }

    // Show user's message immediately.
    const optimisticUserMsg: Message = {
      id: `tmp-${Date.now()}`,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
      attachments,
    }

    set((state) => ({
      messages: [...state.messages, optimisticUserMsg],
      streamingText: '',
      status: 'thinking',
    }))

    // IMPORTANT:
    // Send the attachments along with the message.
    await runStream(chatId, {
      content,
      attachments,
      model: get().selectedModel || DEFAULT_MODEL_ID,
    })
  },

  regenerate: async () => {
    const chatId = get().activeChatId

    if (!chatId) return

    set({
      streamingText: '',
      status: 'thinking',
    })

    await runStream(chatId, {
      regenerate: true,
      model: get().selectedModel || DEFAULT_MODEL_ID,
    })
  },

  stop: () => {
    abortController?.abort()
    abortController = null
  },
}))

interface RunStreamPayload {
  content?: string
  regenerate?: boolean
  attachments?: Attachment[]
  model?: string
}

async function runStream(
  chatId: string,
  payload: RunStreamPayload,
) {
  const state = useChatStore.getState()

  // Regenerate: remove trailing assistant message locally.
  if (payload.regenerate) {
    const msgs = [...state.messages]

    while (
      msgs.length > 0 &&
      msgs[msgs.length - 1].role === 'assistant'
    ) {
      msgs.pop()
    }

    useChatStore.setState({
      messages: msgs,
    })
  }

  abortController = new AbortController()

  try {
    await streamChat(
      chatId,
      {
        content: payload.content,
        regenerate: payload.regenerate,
        attachments: payload.attachments,
        model: payload.model,
      },
      ({ event, data }) => {
        const currentState = useChatStore.getState()

        // Gemini streaming chunk.
        if (event === 'delta') {
          useChatStore.setState({
            streamingText:
              (currentState.streamingText ?? '') +
              String(data.text ?? ''),
          })

          return
        }

        // Backend finished.
        if (event === 'done') {
          const msg = data.message as Message

          const titleUpdated =
            Boolean(data.title_updated) ||
            Boolean(data.title)

          useChatStore.setState({
            messages: [...currentState.messages, msg],
            streamingText: null,
            status: 'caught',
          })

          if (titleUpdated) {
            useChatStore.setState((current) => ({
              chats: current.chats.map((chat) =>
                chat.id === chatId
                  ? {
                      ...chat,
                      title: String(data.title),
                    }
                  : chat,
              ),
            }))
          }

          markCaught()

          return
        }

        // Backend error.
        if (event === 'error') {
          const detail = String(data.detail ?? '')
          const quotaHit = /429|RESOURCE_EXHAUSTED|quota|usage limit/i.test(detail)

          useChatStore.setState({
            streamingText: quotaHit
              ? 'This model has reached its free usage limit. Pick another model from the selector above the message box and try again.'
              : detail + '\n\nPlease try again in a moment.',
          })

          return
        }
      },
    )

    const currentState = useChatStore.getState()

    if (currentState.status === 'thinking') {
      markCaught()
    }
  } catch (err) {
    // User pressed Stop.
    if ((err as Error).name === 'AbortError') {
      setTimeout(() => {
        const id = useChatStore.getState().activeChatId

        if (!id) return

        apiGetChat(id)
          .then((chat) => {
            useChatStore.setState({
              messages: chat.messages,
            })
          })
          .catch(() => undefined)
      }, 1200)
    } else {
      const currentState = useChatStore.getState()

      if (!currentState.streamingText) {
        useChatStore.setState({
          streamingText:
            "Sorry — Sohano.ai couldn't reach the AI service. Please check your connection and try again.",
        })
      }
    }

    markCaught()
  } finally {
    useChatStore.setState({
      streamingText: null,
    })

    abortController = null

    // Refresh sidebar.
    useChatStore
      .getState()
      .loadChats()
      .catch(() => undefined)
  }
}