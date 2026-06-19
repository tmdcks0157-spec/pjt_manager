import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth-store'
import type { Company, Contact } from '@/types'

export function useContacts() {
  const user = useAuthStore((s) => s.user)
  return useQuery<Contact[]>({
    queryKey: ['contacts'],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*, company:companies(*)')
        .order('name')
      if (error) throw error
      return data ?? []
    },
  })
}

export function useContact(id: string) {
  const user = useAuthStore((s) => s.user)
  return useQuery<Contact>({
    queryKey: ['contacts', id],
    enabled: !!user && !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*, company:companies(*)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
  })
}

export function useCompanies() {
  const user = useAuthStore((s) => s.user)
  return useQuery<Company[]>({
    queryKey: ['companies'],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name')
      if (error) throw error
      return data ?? []
    },
  })
}


export function useCreateContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Omit<Contact, 'id' | 'user_id' | 'company' | 'created_at' | 'updated_at'>) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('contacts').insert({ ...input, user_id: user!.id })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] })
    },
  })
}

export function useUpdateContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<Contact> & { id: string }) => {
      const { error } = await supabase
        .from('contacts')
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['contacts'] })
      qc.invalidateQueries({ queryKey: ['contacts', id] })
    },
  })
}

export function useDeleteContact() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('contacts').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] })
    },
  })
}

export function useCreateCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: Omit<Company, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('companies')
        .insert({ ...input, user_id: user!.id })
        .select()
        .single()
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] })
    },
  })
}

export function useUpdateCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<Company> & { id: string }) => {
      const { error } = await supabase
        .from('companies')
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] })
      qc.invalidateQueries({ queryKey: ['contacts'] })
    },
  })
}

export function useDeleteCompany() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('companies').delete().eq('id', id)
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] })
      qc.invalidateQueries({ queryKey: ['contacts'] })
    },
  })
}
