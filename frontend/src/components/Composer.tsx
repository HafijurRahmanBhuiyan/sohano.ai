import { FileText, Image as ImageIcon, Loader2, Plus, SendHorizontal, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { apiUploadFiles } from '../api/client'
import type { Attachment } from '../api/types'
import ModelPicker from './ModelPicker'

const ACCEPTED = '.pdf,.docx,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp'

interface PendingFile {
  localId: string
  file: File
  uploading: boolean
  attachment?: Attachment
  previewUrl?: string
  error?: string
}

export default function Composer({
  onSend,
  onStop,
  streaming,
}: {
  onSend: (content: string, attachments: Attachment[]) => void
  onStop: () => void
  streaming: boolean
}) {
  const [text, setText] = useState('')
  const [pending, setPending] = useState<PendingFile[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [text])

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const newPending: PendingFile[] = Array.from(files).map((file) => ({
      localId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      uploading: true,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    }))
    setPending((p) => [...p, ...newPending])

    for (const p of newPending) {
      try {
        const [attachment] = await apiUploadFiles([p.file])
        setPending((prev) =>
          prev.map((x) =>
            x.localId === p.localId ? { ...x, uploading: false, attachment } : x,
          ),
        )
      } catch (err) {
        setPending((prev) =>
          prev.map((x) =>
            x.localId === p.localId
              ? { ...x, uploading: false, error: (err as Error).message || 'Upload failed' }
              : x,
          ),
        )
      }
    }
  }

  const canSend = text.trim().length > 0 && !pending.some((p) => p.uploading)

  const send = () => {
    if (!canSend) return
    const attachments = pending
      .filter((p) => p.attachment)
      .map((p) => p.attachment!) as Attachment[]
    onSend(text.trim(), attachments)
    setText('')
    setPending([])
  }

  return (
    <div className="px-3 md:px-6 pb-4 pt-2">
      <div className="mx-auto max-w-3xl">
        {/* model selector */}
        <div className="mb-2">
          <ModelPicker />
        </div>

        {/* pending files row */}
        {pending.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {pending.map((p) => (
              <div
                key={p.localId}
                className={`relative flex items-center gap-2 rounded-xl border px-3 py-2 text-xs max-w-[220px]
                  ${
                    p.error
                      ? 'border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 text-red-700 dark:text-red-300'
                      : 'border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800'
                  }`}
              >
                <button
                  onClick={() => setPending((prev) => prev.filter((x) => x.localId !== p.localId))}
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-zinc-600 text-white p-0.5 hover:bg-red-500"
                  aria-label="Remove file"
                >
                  <X size={11} />
                </button>
                {p.uploading ? (
                  <Loader2 size={18} className="shrink-0 animate-spin text-brand-500" />
                ) : p.previewUrl ? (
                  <img src={p.previewUrl} alt={p.file.name} className="h-8 w-8 rounded object-cover" />
                ) : (
                  <FileText size={18} className="shrink-0 text-brand-500" />
                )}
                <span className="truncate font-medium" title={p.error ?? p.file.name}>
                  {p.error ?? p.file.name}
                </span>
              </div>
            ))}
          </div>
        )}

        <div
          className="flex items-end gap-1.5 rounded-3xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900
                     shadow-lg shadow-black/5 px-2 py-2 focus-within:ring-2 ring-brand-300/60 transition"
        >
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:text-brand-600
                       hover:bg-brand-50 dark:hover:bg-zinc-800 transition-colors"
            title="Upload files or images"
            aria-label="Upload files"
          >
            <Plus size={20} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files)
              e.target.value = ''
            }}
          />

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            rows={1}
            placeholder="Message Sohano.ai…"
            className="flex-1 resize-none bg-transparent px-1 py-2 text-[15px] outline-none
                       placeholder:text-zinc-400 max-h-[200px]"
          />

          {streaming ? (
            <button
              onClick={onStop}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-80 transition"
              title="Stop generating"
              aria-label="Stop generating"
            >
              <span className="block h-3 w-3 rounded-[2px] bg-current" />
            </button>
          ) : (
            <button
              onClick={send}
              disabled={!canSend}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white
                         disabled:opacity-35 disabled:cursor-not-allowed hover:bg-brand-600 transition"
              title="Send message"
              aria-label="Send message"
            >
              <SendHorizontal size={17} />
            </button>
          )}
        </div>

        <p className="mt-2 flex items-center justify-center gap-1 text-center text-[11px] text-zinc-400">
          <ImageIcon size={11} /> PDF, DOCX, XLSX, CSV, TXT & images up to 25MB · Sohano.ai can make mistakes.
        </p>
      </div>
    </div>
  )
}
