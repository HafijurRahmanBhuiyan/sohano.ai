import { useEffect, useRef } from 'react'
import { useChatStore } from '../store/chat'
import Composer from './Composer'
import MessageBubble from './MessageBubble'

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-white text-2xl font-bold shadow-lg shadow-brand-500/25">
        S
      </div>
      <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
        Hi, I'm <span className="text-brand-500">Sohano</span>.ai
      </h1>
      <p className="max-w-md text-zinc-500 dark:text-zinc-400 text-sm md:text-base">
        Ask me anything, or attach files and images — I'll read them and give you a
        well-researched answer.
      </p>
      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
        {[
          'Explain quantum computing like I am five',
          'Summarize this PDF in five bullet points',
          'Write a Python script to rename files in bulk',
          'What are the best practices for REST APIs?',
        ].map((s) => (
          <button
            key={s}
            onClick={() => useChatStore.getState().send(s)}
            className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900
                       px-3.5 py-3 text-left text-[13px] hover:border-brand-300 hover:bg-brand-50/60
                       dark:hover:bg-zinc-800 transition"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ChatWindow() {
  const messages = useChatStore((s) => s.messages)
  const streamingText = useChatStore((s) => s.streamingText)
  const send = useChatStore((s) => s.send)
  const stop = useChatStore((s) => s.stop)
  const regenerate = useChatStore((s) => s.regenerate)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, streamingText])

  const lastAssistantIdx = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return i
    }
    return -1
  })()

  if (messages.length === 0 && streamingText === null) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <EmptyState />
        <Composer onSend={send} onStop={stop} streaming={false} />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6">
          {messages.map((m, idx) => (
            <MessageBubble
              key={m.id}
              message={m}
              onRegenerate={
                !streamingText && m.role === 'assistant' && idx === lastAssistantIdx
                  ? regenerate
                  : undefined
              }
            />
          ))}

          {/* live streaming assistant bubble */}
          {streamingText !== null && (
            <MessageBubble
              streaming
              message={{
                id: 'streaming',
                role: 'assistant',
                content: streamingText || '',
                created_at: new Date().toISOString(),
                attachments: [],
              }}
            />
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <Composer onSend={send} onStop={stop} streaming={streamingText !== null} />
    </div>
  )
}
