export interface ModelOption {
  id: string
  label: string
}

/*
 * Free-tier Gemini models available through the backend.
 *
 * Each model has its own separate usage quota, so when one model
 * hits its daily limit the user can simply switch to another here
 * (mirrors Google Gemini's own model selector behaviour).
 */
export const MODELS: ModelOption[] = [
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash' },
  { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash' },
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite' },
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
]

export const DEFAULT_MODEL_ID = MODELS[0].id

const STORAGE_KEY = 'sohano_model'

export function loadSavedModel(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)

    if (saved && MODELS.some((model) => model.id === saved)) {
      return saved
    }
  } catch {
    // localStorage unavailable (private mode etc.) — fall through.
  }

  return DEFAULT_MODEL_ID
}

export function saveModel(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // Ignore storage failures; selection still applies for this session.
  }
}
