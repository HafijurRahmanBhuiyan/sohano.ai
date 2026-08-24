import type { Attachment, ChatDetail, ChatSummary, User } from './types'

export const API_BASE = '/api'

const TOKEN_KEY = 'sohano_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) }
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json'
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail ?? body)
    } catch {
      /* ignore */
    }
    if (res.status === 401) setToken(null)
    throw new ApiError(res.status, detail)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

/* ---------- auth ---------- */
export const apiSignup = (name: string, email: string, password: string) =>
  request<{ access_token: string }>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  })

export const apiLogin = (email: string, password: string) =>
  request<{ access_token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })

export const apiMe = () => request<User>('/auth/me')

export const apiUpdateProfile = (payload: { name?: string; avatar_url?: string }) =>
  request<User>('/auth/me', { method: 'PATCH', body: JSON.stringify(payload) })

export const apiChangePassword = (current_password: string, new_password: string) =>
  request<void>('/auth/me/password', {
    method: 'POST',
    body: JSON.stringify({ current_password, new_password }),
  })

/* ---------- chats ---------- */
export const apiListChats = (q = '') =>
  request<ChatSummary[]>(`/chats${q ? `?q=${encodeURIComponent(q)}` : ''}`)

export const apiCreateChat = () => request<ChatSummary>('/chats', { method: 'POST', body: '{}' })

export const apiGetChat = (id: string) => request<ChatDetail>(`/chats/${id}`)

export const apiRenameChat = (id: string, title: string) =>
  request<ChatSummary>(`/chats/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) })

export const apiDeleteChat = (id: string) => request<void>(`/chats/${id}`, { method: 'DELETE' })

export const apiUploadFiles = async (files: File[]): Promise<Attachment[]> => {
  const form = new FormData()
  for (const f of files) form.append('files', f)
  return request<Attachment[]>('/upload', { method: 'POST', body: form })
}

/* ---------- SSE streaming ---------- */
export interface StreamEvent {
  event: string
  data: Record<string, unknown>
}

export async function streamChat(
  chatId: string,
  payload: { content?: string; regenerate?: boolean },
  onEvent: (evt: StreamEvent) => void,
): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'text/event-stream' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const url = payload.regenerate ? `${API_BASE}/chats/${chatId}/regenerate` : `${API_BASE}/chats/${chatId}/messages`
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content: payload.content ?? '' , attachment_ids: [] }),
  })
  if (!res.ok || !res.body) throw new ApiError(res.status, 'Failed to start the response stream.')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let sep: number
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const rawEvent = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)
      let event = 'message'
      let data = ''
      for (const line of rawEvent.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) data += line.slice(5).trim()
      }
      if (!data) continue
      try {
        onEvent({ event, data: JSON.parse(data) })
      } catch {
        /* skip malformed event */
      }
    }
  }
}
