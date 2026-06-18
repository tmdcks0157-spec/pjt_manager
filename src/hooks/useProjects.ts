import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth-store'
import type { Project } from '@/types'

export function useProjects() {
  const user = useAuthStore((s) => s.user)
  return useQuery<Project[]>({
    queryKey: ['projects'],
    enabled: !!user,
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
