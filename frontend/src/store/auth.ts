import { create } from 'zustand'
import { apiMe, setToken, getToken } from '../api/client'
import type { User } from '../api/types'

interface AuthState {
  user: User | null
  initialized: boolean
  logout: () => void
  loadMe: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  initialized: false,

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
