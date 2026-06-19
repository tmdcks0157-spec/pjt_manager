import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth-store'
import type { Activity } from '@/types'

export function useActivities(contactId: string) {
  const user = useAuthStore((s) => s.user)
  return useQuery<Activity[]>({
    queryKey: ['activities', contactId],
    enabled: !!user && !!contactId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .eq('contact_id', contactId)
        .order('activity_date', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })
}

export function useCreateActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Omit<Activity, 'id' | 'user_id' | 'created_at'>) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('activities').insert({ ...input, user_id: user!.id })
      if (error) throw error
    },
    onSuccess: (_, { contact_id }) => {
      qc.invalidateQueries({ queryKey: ['activities', contact_id] })
    },
  })
}

export function useUpdateActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, contact_id, ...input }: Partial<Activity> & { id: string; contact_id: string }) => {
      const { error } = await supabase.from('activities').update(input).eq('id', id)
      if (error) throw error
      return contact_id
    },
    onSuccess: (contact_id) => {
      qc.invalidateQueries({ queryKey: ['activities', contact_id] })
    },
  })
}

export function useDeleteActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, contact_id }: { id: string; contact_id: string }) => {
      const { error } = await supabase.from('activities').delete().eq('id', id)
      if (error) throw error
      return contact_id
    },
    onSuccess: (contact_id) => {
      qc.invalidateQueries({ queryKey: ['activities', contact_id] })
    },
  })
}
