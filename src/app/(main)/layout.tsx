'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { LayoutDashboard, Calendar, LogOut, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: '대시보드', icon: LayoutDashboard },
  { href: '/calendar', label: '캘린더', icon: Calendar },
]

interface SearchResult {
  id: string
  title: string
  project_id: string
  project_name: string
  project_color: string
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()

  // ── 탭 타이틀 배지 ──
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

  // ── 전역 검색 ──
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Cmd/Ctrl+K 단축키
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // 디바운스 검색
  useEffect(() => {
    const q = query.trim()
    if (!q) { setResults([]); setOpen(false); return }

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const [{ data: tasks }, { data: projects }] = await Promise.all([
          supabase.from('tasks')
            .select('id, title, project_id')
            .is('deleted_at', null).eq('archived', false)
            .ilike('title', `%${q}%`)
            .limit(10),
          supabase.from('projects')
            .select('id, name, color')
            .is('deleted_at', null).eq('archived', false),
        ])
        const projMap = Object.fromEntries((projects ?? []).map(p => [p.id, p]))
        const items: SearchResult[] = (tasks ?? [])
          .filter(t => projMap[t.project_id])
          .map(t => ({
            id: t.id,
            title: t.title,
            project_id: t.project_id,
            project_name: projMap[t.project_id].name,
            project_color: projMap[t.project_id].color,
          }))
        setResults(items)
        setOpen(true)
        setSelected(-1)
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [query])

  function navigate(result: SearchResult) {
    router.push(`/projects/${result.project_id}`)
    setQuery('')
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected(prev => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && selected >= 0) {
      navigate(results[selected])
    } else if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  async function handleLogout() {
    await logout()
    router.push('/')
  }

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col py-6 px-3 shrink-0">
        <div className="px-3 mb-4">
          <h1 className="font-bold text-base tracking-tight">My PM</h1>
          {user && <p className="text-xs text-gray-400 mt-0.5 truncate">{user.email}</p>}
        </div>

        {/* 전역 검색 */}
        <div ref={containerRef} className="relative px-1 mb-4">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => { if (results.length > 0) setOpen(true) }}
              onKeyDown={handleKeyDown}
              placeholder="검색 (⌘K)"
              className="w-full pl-7 pr-6 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:bg-white transition-all"
            />
            {query && (
              <button
                onClick={() => { setQuery(''); setOpen(false) }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* 검색 결과 드롭다운 */}
          {open && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
              {loading && (
                <p className="text-xs text-gray-400 px-3 py-2.5">검색 중...</p>
              )}
              {!loading && results.length === 0 && (
                <p className="text-xs text-gray-400 px-3 py-2.5">결과 없음</p>
              )}
              {!loading && results.map((r, i) => (
                <button
                  key={r.id}
                  onClick={() => navigate(r)}
                  onMouseEnter={() => setSelected(i)}
                  className={cn(
                    'w-full text-left px-3 py-2 flex items-center gap-2 transition-colors',
                    selected === i ? 'bg-gray-100' : 'hover:bg-gray-50'
                  )}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: r.project_color }}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-medium text-gray-800 truncate">{r.title}</span>
                    <span className="block text-[10px] text-gray-400 truncate">{r.project_name}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
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
