import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth-store'
import type { Task } from '@/types'

export function useAllTasks() {
  const user = useAuthStore((s) => s.user)
  return useQuery<Task[]>({
    queryKey: ['tasks'],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, checklist_items(*)')
        .is('deleted_at', null)
        .eq('archived', false)
      if (error) throw error
      return data
    },
  })
}
