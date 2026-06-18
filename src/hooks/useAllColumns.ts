import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth-store'
import type { ProjectColumn } from '@/types'

export function useAllColumns() {
  const user = useAuthStore((s) => s.user)
  return useQuery<ProjectColumn[]>({
    queryKey: ['columns'],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('columns').select('*')
      if (error) throw error
      return data
    },
  })
}
