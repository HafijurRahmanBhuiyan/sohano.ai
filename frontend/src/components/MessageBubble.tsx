import { Check, Copy, FileText, RefreshCw, ThumbsDown, ThumbsUp } from 'lucide-react'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'
import type { Message } from '../api/types'

function AttachmentChip({ name, url, type }: { name: string; url: string; type: string }) {
  const isImage = type.startsWith('image/')
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700
                 bg-white/70 dark:bg-zinc-800/70 px-2.5 py-1.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-700 transition"
    >
      {isImage ? (
        <img src={url} alt={name} className="h-8 w-8 rounded object-cover" />
      ) : (
        <FileText size={18} className="shrink-0 text-brand-500" />
      )}
      <span className="max-w-[160px] truncate font-medium">{name}</span>
    </a>
  )
}

export default function MessageBubble({
  message,
  streaming = false,
  onRegenerate,
}: {
  message: Message
  streaming?: boolean
  onRegenerate?: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [vote, setVote] = useState<'up' | 'down' | null>(null)
  const isUser = message.role === 'user'

  const copy = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] md:max-w-[75%] space-y-2">
          {message.attachments.length > 0 && (
            <div className="flex flex-wrap justify-end gap-2">
              {message.attachments.map((a) => (
                <AttachmentChip key={a.id} name={a.file_name} url={a.file_url} type={a.file_type} />
              ))}
            </div>
          )}
          <div className="rounded-2xl rounded-br-md bg-brand-500 text-white px-4 py-2.5 shadow-sm whitespace-pre-wrap break-words text-[15px] leading-relaxed">
            {message.content}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex flex-col items-start w-full max-w-[85%] md:max-w-[75%]">
      <div className="flex items-start gap-3 w-full">
        <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-white text-xs font-bold shadow-sm">
          S
        </span>
        <div className="min-w-0 flex-1 sohano-md">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
            {message.content + (streaming ? '▍' : '')}
          </ReactMarkdown>
        </div>
      </div>

      {!streaming && (
        <div className="ml-10 mt-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button
            onClick={copy}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Copy"
          >
            {copied ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
          </button>
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              title="Regenerate response"
            >
              <RefreshCw size={15} />
            </button>
          )}
          <button
            onClick={() => setVote((v) => (v === 'up' ? null : 'up'))}
            className={`p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
              vote === 'up' ? 'text-green-600' : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
            title="Good response"
          >
            <ThumbsUp size={15} />
          </button>
          <button
            onClick={() => setVote((v) => (v === 'down' ? null : 'down'))}
            className={`p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
              vote === 'down' ? 'text-red-500' : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
            }`}
            title="Bad response"
          >
            <ThumbsDown size={15} />
          </button>
        </div>
      )}
    </div>
  )
}
