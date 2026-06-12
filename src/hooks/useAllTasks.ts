import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Task } from '@/types'

export function useAllTasks() {
  return useQuery<Task[]>({
    queryKey: ['tasks'],
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
