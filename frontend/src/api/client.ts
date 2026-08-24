import type { Attachment, ChatDetail, ChatSummary, User } from './types'

export const API_BASE = '/api'

const TOKEN_KEY = 'sohano_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  }

  // For FormData, browser must set Content-Type automatically
  // so that the multipart boundary is included correctly.
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const token = getToken()

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    let detail = res.statusText || 'Request failed'

    try {
      const body = await res.json()

      detail =
        typeof body.detail === 'string'
          ? body.detail
          : JSON.stringify(body.detail ?? body)
    } catch {
      // Response was not JSON.
    }

    if (res.status === 401) {
      setToken(null)
    }

    throw new ApiError(res.status, detail)
  }

  if (res.status === 204) {
    return undefined as T
  }

  return res.json() as Promise<T>
}

/* =========================================================
   AUTH
   ========================================================= */

export const apiSignup = (
  name: string,
  email: string,
  password: string,
) =>
  request<{ access_token: string }>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({
      name,
      email,
      password,
    }),
  })

export const apiLogin = (
  email: string,
  password: string,
) =>
  request<{ access_token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
    }),
  })

export const apiMe = () =>
  request<User>('/auth/me')

export const apiUpdateProfile = (
  payload: {
    name?: string
    avatar_url?: string
  },
) =>
  request<User>('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })

export const apiChangePassword = (
  current_password: string,
  new_password: string,
) =>
  request<void>('/auth/me/password', {
    method: 'POST',
    body: JSON.stringify({
      current_password,
      new_password,
    }),
  })

/* =========================================================
   CHATS
   ========================================================= */

export const apiListChats = (q = '') =>
  request<ChatSummary[]>(
    `/chats${q ? `?q=${encodeURIComponent(q)}` : ''}`,
  )

export const apiCreateChat = () =>
  request<ChatSummary>('/chats', {
    method: 'POST',
    body: '{}',
  })

export const apiGetChat = (id: string) =>
  request<ChatDetail>(`/chats/${id}`)

export const apiRenameChat = (
  id: string,
  title: string,
) =>
  request<ChatSummary>(`/chats/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      title,
    }),
  })

export const apiDeleteChat = (id: string) =>
  request<void>(`/chats/${id}`, {
    method: 'DELETE',
  })

/* =========================================================
   FILE UPLOAD
   ========================================================= */

export const apiUploadFiles = async (
  files: File[],
): Promise<Attachment[]> => {
  const form = new FormData()

  for (const file of files) {
    form.append('files', file)
  }

  return request<Attachment[]>('/upload', {
    method: 'POST',
    body: form,
  })
}

/* =========================================================
   SSE STREAMING
   ========================================================= */

export interface StreamEvent {
  event: string
  data: Record<string, unknown>
}

/*
 * This is the payload used by the frontend.
 *
 * attachments contains the Attachment objects returned
 * from /upload.
 *
 * Before sending to FastAPI, streamChat converts them to:
 *
 * {
 *   content: "...",
 *   attachment_ids: ["id1", "id2"]
 * }
 */
export interface StreamChatPayload {
  content?: string
  attachments?: Attachment[]
  attachment_ids?: string[]
  regenerate?: boolean
  model?: string
}

export async function streamChat(
  chatId: string,
  payload: StreamChatPayload,
  onEvent: (evt: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  }

  const token = getToken()

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const isRegenerate = Boolean(payload.regenerate)

  const url = isRegenerate
    ? `${API_BASE}/chats/${chatId}/regenerate`
    : `${API_BASE}/chats/${chatId}/messages`

  /*
   * Convert uploaded Attachment objects into the IDs
   * expected by the FastAPI SendMessageRequest schema.
   *
   * Backend expects:
   *
   * attachment_ids: List[str]
   */
  const attachmentIds =
    payload.attachment_ids ??
    payload.attachments?.map((attachment) => attachment.id) ??
    []

  /*
   * Regenerate endpoint only needs the model selection (if any);
   * the normal endpoint carries the message content too.
   */
  const body = isRegenerate
    ? {
        model: payload.model,
      }
    : {
        content: payload.content ?? '',
        attachment_ids: attachmentIds,
        model: payload.model,
      }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  })

  if (!res.ok || !res.body) {
    let detail = 'Failed to start the response stream.'

    try {
      const responseBody = await res.json()

      if (typeof responseBody.detail === 'string') {
        detail = responseBody.detail
      } else if (responseBody.detail) {
        detail = JSON.stringify(responseBody.detail)
      }
    } catch {
      // Ignore JSON parsing errors.
    }

    throw new ApiError(res.status, detail)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()

  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    buffer += decoder.decode(value, {
      stream: true,
    })

    let separatorIndex: number

    while ((separatorIndex = buffer.indexOf('\n\n')) !== -1) {
      const rawEvent = buffer.slice(0, separatorIndex)

      buffer = buffer.slice(separatorIndex + 2)

      let event = 'message'
      let data = ''

      for (const line of rawEvent.split('\n')) {
        if (line.startsWith('event:')) {
          event = line.slice(6).trim()
        } else if (line.startsWith('data:')) {
          data += line.slice(5).trim()
        }
      }

      if (!data) {
        continue
      }

      try {
        onEvent({
          event,
          data: JSON.parse(data),
        })
      } catch {
        // Ignore malformed SSE events.
      }
    }
  }

  /*
   * Process any final buffered SSE event if the server closed
   * the connection without an additional blank line.
   */
  if (buffer.trim()) {
    let event = 'message'
    let data = ''

    for (const line of buffer.split('\n')) {
      if (line.startsWith('event:')) {
        event = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        data += line.slice(5).trim()
      }
    }

    if (data) {
      try {
        onEvent({
          event,
          data: JSON.parse(data),
        })
      } catch {
        // Ignore malformed final SSE event.
      }
    }
  }
}