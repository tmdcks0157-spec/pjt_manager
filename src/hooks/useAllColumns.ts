import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ProjectColumn } from '@/types'

export function useAllColumns() {
  return useQuery<ProjectColumn[]>({
    queryKey: ['columns'],
    queryFn: async () => {
      const { data, error } = await supabase.from('columns').select('*')
      if (error) throw error
      return data
    },
  })
}
