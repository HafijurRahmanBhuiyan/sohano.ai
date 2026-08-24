export interface User {
  id: string
  name: string
  email: string
  avatar_url: string
}

export interface Attachment {
  id: string
  file_name: string
  file_url: string
  file_type: string
  extracted_text: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
  attachments: Attachment[]
}

export interface ChatSummary {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export interface ChatDetail extends ChatSummary {
  messages: Message[]
}
