'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { LayoutDashboard, Calendar, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: '대시보드', icon: LayoutDashboard },
  { href: '/calendar', label: '캘린더', icon: Calendar },
]

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()

  const { data: overdueCount = 0 } = useQuery({
    queryKey: ['tab-badge-overdue'],
    enabled: !!user,
    refetchInterval: 5 * 60 * 1000,
    queryFn: async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const todayStr = today.toISOString().split('T')[0]

      const [{ data: cols }, { data: tasks }] = await Promise.all([
        supabase.from('columns').select('id, name'),
        supabase.from('tasks').select('id, status, due_date')
          .is('deleted_at', null).eq('archived', false)
          .not('due_date', 'is', null).lt('due_date', todayStr),
      ])

      const doneIds = new Set((cols ?? []).filter(c => c.name === '완료').map(c => c.id))
      return (tasks ?? []).filter(t => !doneIds.has(t.status)).length
    },
  })

  useEffect(() => {
    document.title = overdueCount > 0 ? `(${overdueCount}) My PM` : 'My PM'
  }, [overdueCount])

  async function handleLogout() {
    await logout()
    router.push('/')
  }

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col py-6 px-3 shrink-0">
        <div className="px-3 mb-6">
          <h1 className="font-bold text-base tracking-tight">My PM</h1>
          {user && <p className="text-xs text-gray-400 mt-0.5 truncate">{user.email}</p>}
        </div>

        <nav className="flex-1 space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                pathname === href
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors"
        >
          <LogOut size={16} />
          로그아웃
        </button>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto bg-gray-50">{children}</main>
    </div>
  )
}
