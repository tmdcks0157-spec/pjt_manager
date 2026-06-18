'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'

export default function HomePage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!mounted) return
    if (user) {
      const startPage = localStorage.getItem('start-page') ?? '/today'
      router.replace(startPage)
    } else {
      router.replace('/login')
    }
  }, [mounted, user])

  return null
}
