import { create } from 'zustand'
import { apiLogin, apiMe, apiSignup, setToken, getToken } from '../api/client'
import type { User } from '../api/types'

interface AuthState {
  user: User | null
  initialized: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
  loadMe: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  initialized: false,

  login: async (email, password) => {
    const { access_token } = await apiLogin(email, password)
    setToken(access_token)
    const user = await apiMe()
    set({ user })
  },

  signup: async (name, email, password) => {
    const { access_token } = await apiSignup(name, email, password)
    setToken(access_token)
    const user = await apiMe()
    set({ user })
  },

  logout: () => {
    setToken(null)
    set({ user: null })
  },

  loadMe: async () => {
    if (!getToken()) {
      set({ user: null, initialized: true })
      return
    }
    try {
      const user = await apiMe()
      set({ user, initialized: true })
    } catch {
      setToken(null)
      set({ user: null, initialized: true })
    }
  },
}))
