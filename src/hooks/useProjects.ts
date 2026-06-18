import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Project } from '@/types'

export function useProjects() {
  return useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .is('deleted_at', null)
        .eq('archived', false)
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}
