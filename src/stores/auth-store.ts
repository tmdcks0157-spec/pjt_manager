import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'
import type { User } from '@/types'

interface AuthState {
  user: User | null
  isLoading: boolean
  isInitialized: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, name?: string) => Promise<void>
  logout: () => Promise<void>
  fetchMe: () => Promise<void>
  init: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: false,
      isInitialized: false,

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

      // 앱 시작 시 Supabase 세션 확인 후 user 동기화
      init: async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          const u = session.user
          set({ user: { _id: u.id, email: u.email!, name: u.user_metadata?.name } })
        } else {
          set({ user: null })
        }
        set({ isInitialized: true })
      },
    }),
    { name: 'auth-storage', partialize: (s) => ({ user: s.user }) }
  )
)

// 세션 변경(갱신/만료/로그아웃) 감지 → Zustand 자동 동기화
if (typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      const u = session.user
      useAuthStore.setState({ user: { _id: u.id, email: u.email!, name: u.user_metadata?.name } })
    } else if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' && !session) {
      useAuthStore.setState({ user: null })
    }
  })
}
