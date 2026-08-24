import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { MODELS } from '../config/models'
import { useChatStore } from '../store/chat'

export default function ModelPicker() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const selectedModel = useChatStore((state) => state.selectedModel)
  const setSelectedModel = useChatStore((state) => state.setSelectedModel)

  const active = MODELS.find((model) => model.id === selectedModel) ?? MODELS[0]

  // Close the menu on outside click or Escape.
  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const select = (id: string) => {
    setSelectedModel(id)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700
                   bg-white dark:bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-200
                   hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
        title="Choose a model"
      >
        {active.label}
        <ChevronDown size={13} className={`text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Models"
          className="absolute bottom-full z-30 mb-1.5 w-56 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700
                     bg-white dark:bg-zinc-900 shadow-xl shadow-black/10"
        >
          <p className="border-b border-zinc-100 dark:border-zinc-800 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Choose your model
          </p>
          {MODELS.map((model) => (
            <button
              key={model.id}
              type="button"
              role="option"
              aria-selected={model.id === active.id}
              onClick={() => select(model.id)}
              className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] transition-colors
                ${
                  model.id === active.id
                    ? 'bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300 font-medium'
                    : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
            >
              <span className="truncate">{model.label}</span>
              {model.id === active.id && <Check size={14} className="shrink-0" />}
            </button>
          ))}
          <p className="border-t border-zinc-100 dark:border-zinc-800 px-3 py-2 text-[11px] leading-snug text-zinc-400">
            Each model has its own free daily limit — switch if one runs out.
          </p>
        </div>
      )}
    </div>
  )
}
