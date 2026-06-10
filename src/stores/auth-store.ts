import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, name?: string) => Promise<void>
  logout: () => Promise<void>
  fetchMe: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true })
        try {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password })
          if (error) throw error
          const u = data.user
          set({
            user: { _id: u.id, email: u.email!, name: u.user_metadata?.name },
            isLoading: false,
          })
        } catch (e) {
          set({ isLoading: false })
          throw e
        }
      },

      signup: async (email, password, name) => {
        set({ isLoading: true })
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { name } },
          })
          if (error) throw error
          const u = data.user
          if (u) {
            set({
              user: { _id: u.id, email: u.email!, name: u.user_metadata?.name },
              isLoading: false,
            })
          }
        } catch (e) {
          set({ isLoading: false })
          throw e
        }
      },

      logout: async () => {
        await supabase.auth.signOut()
        set({ user: null })
      },

      fetchMe: async () => {
        const { data } = await supabase.auth.getUser()
        const u = data.user
        if (u) {
          set({ user: { _id: u.id, email: u.email!, name: u.user_metadata?.name } })
        } else {
          set({ user: null })
        }
      },
    }),
    { name: 'auth-storage', partialize: (s) => ({ user: s.user }) }
  )
)
