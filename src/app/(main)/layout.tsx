'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  LayoutDashboard, Calendar, LogOut, Search, X, BarChart2, LayoutGrid,
  ChevronDown, ChevronRight, GripVertical, Settings2, Sun,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Project } from '@/types'

const NAV_ITEMS = [
  { href: '/today',     label: '오늘',       icon: Sun },
  { href: '/dashboard', label: '프로젝트',   icon: LayoutDashboard },
  { href: '/overview',  label: '전체 현황',  icon: LayoutGrid },
  { href: '/calendar',  label: '캘린더',     icon: Calendar },
  { href: '/report',    label: '주간 리포트', icon: BarChart2 },
]

function loadNavOrder(): string[] {
  try {
    const s = localStorage.getItem('nav-order')
    if (s) {
      const parsed: string[] = JSON.parse(s)
      // 새로 추가된 항목도 포함
      const all = NAV_ITEMS.map(n => n.href)
      const merged = [...parsed.filter(h => all.includes(h)), ...all.filter(h => !parsed.includes(h))]
      return merged
    }
  } catch {}
  return NAV_ITEMS.map(n => n.href)
}

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
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (mounted && !user) router.replace('/login')
  }, [mounted, user])

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

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const q = query.trim()
    if (!q) { setResults([]); setOpen(false); return }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const [{ data: tasks }, { data: projects }] = await Promise.all([
          supabase.from('tasks').select('id, title, project_id')
            .is('deleted_at', null).eq('archived', false).ilike('title', `%${q}%`).limit(10),
          supabase.from('projects').select('id, name, color').is('deleted_at', null).eq('archived', false),
        ])
        const projMap = Object.fromEntries((projects ?? []).map(p => [p.id, p]))
        setResults((tasks ?? []).filter(t => projMap[t.project_id]).map(t => ({
          id: t.id, title: t.title, project_id: t.project_id,
          project_name: projMap[t.project_id].name, project_color: projMap[t.project_id].color,
        })))
        setOpen(true); setSelected(-1)
      } finally { setLoading(false) }
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  function navigate(result: SearchResult) {
    router.push(`/projects/${result.project_id}`)
    setQuery(''); setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(p => Math.min(p + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(p => Math.max(p - 1, 0)) }
    else if (e.key === 'Enter' && selected >= 0) navigate(results[selected])
    else if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
  }

  // ── 1. 내비 순서 편집 ──
  const [navOrder, setNavOrder] = useState<string[]>(() => NAV_ITEMS.map(n => n.href))
  const [editingNav, setEditingNav] = useState(false)

  const sortedNav = navOrder
    .map(href => NAV_ITEMS.find(n => n.href === href))
    .filter(Boolean) as typeof NAV_ITEMS

  function moveNav(index: number, dir: -1 | 1) {
    const next = [...navOrder]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setNavOrder(next)
    localStorage.setItem('nav-order', JSON.stringify(next))
  }

  // ── 2. 사이드바 프로젝트 바로가기 ──
  const [projectsOpen, setProjectsOpen] = useState(true)
  const [editingProjects, setEditingProjects] = useState(false)
  const [projectOrder, setProjectOrder] = useState<string[]>([])
  const [hiddenProjects, setHiddenProjects] = useState<Set<string>>(new Set())

  // localStorage는 마운트 후에 읽어야 hydration mismatch 방지
  useEffect(() => {
    setNavOrder(loadNavOrder())
    setProjectsOpen(localStorage.getItem('sidebar-projects-open') !== 'false')
    try {
      const order = localStorage.getItem('sidebar-projects-order')
      if (order) setProjectOrder(JSON.parse(order))
      const hidden = localStorage.getItem('sidebar-projects-hidden')
      if (hidden) setHiddenProjects(new Set(JSON.parse(hidden)))
    } catch {}
  }, [])

  const { data: sidebarProjects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects').select('*').is('deleted_at', null).eq('archived', false).order('created_at')
      if (error) throw error
      return data
    },
  })

  // 저장된 순서 적용 (새 프로젝트는 뒤에 추가)
  const sortedProjects = (() => {
    const ids = sidebarProjects.map(p => p.id)
    const ordered = projectOrder.filter(id => ids.includes(id))
    const newOnes = ids.filter(id => !ordered.includes(id))
    return [...ordered, ...newOnes].map(id => sidebarProjects.find(p => p.id === id)!).filter(Boolean)
  })()

  function moveProject(index: number, dir: -1 | 1) {
    const visibleIds = sortedProjects.filter(p => !hiddenProjects.has(p.id)).map(p => p.id)
    const target = index + dir
    if (target < 0 || target >= visibleIds.length) return
    ;[visibleIds[index], visibleIds[target]] = [visibleIds[target], visibleIds[index]]
    // hidden 항목 포함 전체 순서 재구성
    const hiddenIds = sortedProjects.filter(p => hiddenProjects.has(p.id)).map(p => p.id)
    const newOrder = [...visibleIds, ...hiddenIds]
    setProjectOrder(newOrder)
    localStorage.setItem('sidebar-projects-order', JSON.stringify(newOrder))
  }

  function hideProject(id: string) {
    const next = new Set(hiddenProjects)
    next.add(id)
    setHiddenProjects(next)
    localStorage.setItem('sidebar-projects-hidden', JSON.stringify([...next]))
  }

  function showProject(id: string) {
    const next = new Set(hiddenProjects)
    next.delete(id)
    setHiddenProjects(next)
    localStorage.setItem('sidebar-projects-hidden', JSON.stringify([...next]))
  }

  function toggleProjects() {
    setProjectsOpen(v => {
      localStorage.setItem('sidebar-projects-open', String(!v))
      return !v
    })
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
        <div ref={containerRef} className="relative px-1 mb-3">
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
              <button onClick={() => { setQuery(''); setOpen(false) }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={12} />
              </button>
            )}
          </div>
          {open && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
              {loading && <p className="text-xs text-gray-400 px-3 py-2.5">검색 중...</p>}
              {!loading && results.length === 0 && <p className="text-xs text-gray-400 px-3 py-2.5">결과 없음</p>}
              {!loading && results.map((r, i) => (
                <button key={r.id} onClick={() => navigate(r)} onMouseEnter={() => setSelected(i)}
                  className={cn('w-full text-left px-3 py-2 flex items-center gap-2 transition-colors',
                    selected === i ? 'bg-gray-100' : 'hover:bg-gray-50')}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.project_color }} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-medium text-gray-800 truncate">{r.title}</span>
                    <span className="block text-[10px] text-gray-400 truncate">{r.project_name}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── 내비게이션 (순서 편집 가능) ── */}
        <div className="mb-1">
          <div className="flex items-center justify-between px-3 mb-1">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">메뉴</span>
            <button
              onClick={() => setEditingNav(v => !v)}
              className={cn('p-0.5 rounded transition-colors', editingNav ? 'text-blue-500' : 'text-gray-300 hover:text-gray-500')}
              title="순서 편집"
            >
              <Settings2 size={12} />
            </button>
          </div>

          <nav className="space-y-0.5">
            {sortedNav.map(({ href, label, icon: Icon }, i) => {
              const isDashboard = href === '/dashboard'
              const isActive = pathname === href || (isDashboard && pathname.startsWith('/projects/'))

              if (editingNav) {
                return (
                  <div key={href} className="flex items-center gap-1 rounded-md">
                    <GripVertical size={12} className="text-gray-300 ml-1 shrink-0" />
                    <span className="flex-1 text-sm font-medium text-gray-700 px-1 py-2 truncate">{label}</span>
                    <div className="flex flex-col shrink-0 mr-1">
                      <button onClick={() => moveNav(i, -1)} disabled={i === 0}
                        className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-20 transition-colors">
                        <ChevronDown size={11} className="rotate-180" />
                      </button>
                      <button onClick={() => moveNav(i, 1)} disabled={i === sortedNav.length - 1}
                        className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-20 transition-colors">
                        <ChevronDown size={11} />
                      </button>
                    </div>
                  </div>
                )
              }

              if (isDashboard) {
                return (
                  <div key={href}>
                    {/* 프로젝트 메뉴 행: 왼쪽=링크, 오른쪽=펼침 토글 */}
                    <div className={cn('flex items-center rounded-md transition-colors',
                      isActive ? 'bg-gray-100' : 'hover:bg-gray-50')}>
                      <Link href={href}
                        className="flex items-center gap-2.5 px-3 py-2 text-sm font-medium flex-1 truncate text-gray-900">
                        <Icon size={16} className="shrink-0" />
                        {label}
                      </Link>
                      {projectsOpen && (
                        <button
                          onClick={e => { e.stopPropagation(); setEditingProjects(v => !v) }}
                          className={cn('p-1 rounded transition-colors shrink-0', editingProjects ? 'text-blue-500' : 'text-gray-300 hover:text-gray-500')}
                          title="순서 편집"
                        >
                          <Settings2 size={11} />
                        </button>
                      )}
                      <button
                        onClick={toggleProjects}
                        className="pr-2.5 py-2 text-gray-400 hover:text-gray-700 transition-colors shrink-0"
                        title={projectsOpen ? '접기' : '펼치기'}
                      >
                        {projectsOpen
                          ? <ChevronDown size={13} />
                          : <ChevronRight size={13} />}
                      </button>
                    </div>

                    {/* 프로젝트 바로가기 목록 */}
                    {projectsOpen && (
                      <div className="mt-0.5 mb-1 space-y-0.5 max-h-48 overflow-y-auto">
                        {editingProjects ? (
                          <>
                            {/* 편집 모드: 표시 중인 항목 */}
                            {sortedProjects.filter(p => !hiddenProjects.has(p.id)).map((p, i, arr) => (
                              <div key={p.id} className="flex items-center gap-1 pl-6 pr-1 py-1 rounded-md hover:bg-gray-50">
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                                <span className="flex-1 text-xs text-gray-700 truncate px-1">{p.name}</span>
                                <div className="flex items-center shrink-0 gap-0.5">
                                  <div className="flex flex-col">
                                    <button onClick={() => moveProject(i, -1)} disabled={i === 0}
                                      className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-20 transition-colors">
                                      <ChevronDown size={10} className="rotate-180" />
                                    </button>
                                    <button onClick={() => moveProject(i, 1)} disabled={i === arr.length - 1}
                                      className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-20 transition-colors">
                                      <ChevronDown size={10} />
                                    </button>
                                  </div>
                                  <button onClick={() => hideProject(p.id)}
                                    className="p-0.5 text-gray-300 hover:text-red-400 transition-colors" title="목록에서 숨기기">
                                    <X size={11} />
                                  </button>
                                </div>
                              </div>
                            ))}
                            {/* 숨긴 항목 복원 섹션 */}
                            {hiddenProjects.size > 0 && (
                              <>
                                <p className="text-[10px] text-gray-400 pl-6 pt-2 pb-0.5">숨긴 항목</p>
                                {sortedProjects.filter(p => hiddenProjects.has(p.id)).map(p => (
                                  <div key={p.id} className="flex items-center gap-1 pl-6 pr-1 py-1 rounded-md opacity-50 hover:opacity-100 hover:bg-gray-50">
                                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                                    <span className="flex-1 text-xs text-gray-500 truncate px-1 line-through">{p.name}</span>
                                    <button onClick={() => showProject(p.id)}
                                      className="p-0.5 text-gray-400 hover:text-blue-500 transition-colors" title="다시 표시">
                                      <ChevronDown size={11} className="-rotate-90" />
                                    </button>
                                  </div>
                                ))}
                              </>
                            )}
                            <p className="text-[10px] text-gray-400 pl-6 py-1">X 버튼으로 숨기기</p>
                          </>
                        ) : (
                          sortedProjects.filter(p => !hiddenProjects.has(p.id)).length === 0 ? (
                            <p className="text-[11px] text-gray-400 pl-8 py-1">프로젝트가 없습니다</p>
                          ) : (
                            sortedProjects.filter(p => !hiddenProjects.has(p.id)).map(p => (
                              <Link
                                key={p.id}
                                href={`/projects/${p.id}`}
                                className={cn(
                                  'flex items-center gap-2 pl-8 pr-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                                  pathname === `/projects/${p.id}`
                                    ? 'bg-gray-100 text-gray-900'
                                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                                )}
                              >
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                                <span className="truncate">{p.name}</span>
                              </Link>
                            ))
                          )
                        )}
                      </div>
                    )}
                  </div>
                )
              }

              return (
                <Link key={href} href={href}
                  className={cn('flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900')}>
                  <Icon size={16} />
                  {label}
                </Link>
              )
            })}
          </nav>

          {editingNav && (
            <p className="text-[10px] text-gray-400 px-3 mt-2">↑↓ 버튼으로 순서 변경</p>
          )}
        </div>

        <div className="flex-1" />

        <button
          onClick={handleLogout}
          className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition-colors mt-2 shrink-0"
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
