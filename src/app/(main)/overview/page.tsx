'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Task, TaskPriority, Project, ProjectColumn } from '@/types'
import {
  CalendarDays, ChevronDown, ChevronRight,
  Layers, Siren, CheckSquare, Clock,
  MessageSquare, FileText, AlertCircle, TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const PRIORITY_META: Record<string, { label: string; className: string }> = {
  low:    { label: '낮음', className: 'bg-gray-100 text-gray-500' },
  normal: { label: '보통', className: 'bg-blue-100 text-blue-600' },
  high:   { label: '높음', className: 'bg-orange-100 text-orange-600' },
  urgent: { label: '긴급', className: 'bg-red-100 text-red-600' },
}

type FilterType = 'all' | 'overdue' | 'today' | 'urgent' | 'high'
type ViewType = 'tasks' | 'issues'
type IssueFilterType = 'all' | 'open' | 'closed' | 'note'

interface Post {
  id: string
  project_id: string
  type: 'issue' | 'note'
  title: string
  body?: string | null
  status: 'open' | 'closed'
  priority: string
  created_at: string
}

export default function OverviewPage() {
  const router = useRouter()
  const [view, setView] = useState<ViewType>('tasks')
  const [filter, setFilter] = useState<FilterType>('all')
  const [issueFilter, setIssueFilter] = useState<IssueFilterType>('open')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').is('deleted_at', null).eq('archived', false).order('created_at')
      if (error) throw error
      return data
    },
  })

  const { data: columns = [] } = useQuery<ProjectColumn[]>({
    queryKey: ['all-columns-overview'],
    queryFn: async () => {
      const { data, error } = await supabase.from('columns').select('*')
      if (error) throw error
      return data
    },
  })

  const { data: allTasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ['overview-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, checklist_items(*)')
        .is('deleted_at', null)
        .eq('archived', false)
        .order('priority')
      if (error) throw error
      return data
    },
  })

  const { data: allPosts = [], isLoading: postsLoading } = useQuery<Post[]>({
    queryKey: ['overview-posts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('id, project_id, type, title, body, status, priority, created_at')
        .order('created_at', { ascending: false })
      if (error) {
        if (error.code === '42P01' || error.message?.includes('posts')) return []
        throw error
      }
      return data ?? []
    },
  })

  const doneColIds = useMemo(
    () => new Set(columns.filter(c => c.name === '완료').map(c => c.id)),
    [columns]
  )
  const colMap = useMemo(() => Object.fromEntries(columns.map(c => [c.id, c])), [columns])

  const today = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d
  }, [])

  const activeTasks = useMemo(
    () => allTasks.filter(t => !doneColIds.has(t.status)),
    [allTasks, doneColIds]
  )

  const filteredTasks = useMemo(() => {
    switch (filter) {
      case 'overdue':
        return activeTasks.filter(t => {
          if (!t.due_date || t.task_type === 'meeting') return false
          const d = new Date(t.due_date); d.setHours(0, 0, 0, 0)
          return d < today
        })
      case 'today':
        return activeTasks.filter(t => {
          if (!t.due_date || t.task_type === 'meeting') return false
          const d = new Date(t.due_date); d.setHours(0, 0, 0, 0)
          return d.getTime() === today.getTime()
        })
      case 'urgent':
        return activeTasks.filter(t => t.priority === 'urgent')
      case 'high':
        return activeTasks.filter(t => t.priority === 'high' || t.priority === 'urgent')
      default:
        return activeTasks
    }
  }, [activeTasks, filter, today])

  const filteredPosts = useMemo(() => {
    switch (issueFilter) {
      case 'open':   return allPosts.filter(p => p.type === 'issue' && p.status === 'open')
      case 'closed': return allPosts.filter(p => p.type === 'issue' && p.status === 'closed')
      case 'note':   return allPosts.filter(p => p.type === 'note')
      default:       return allPosts
    }
  }, [allPosts, issueFilter])

  const tasksByProject = useMemo(() => {
    const map: Record<string, Task[]> = {}
    for (const p of projects) map[p.id] = []
    for (const t of filteredTasks) {
      if (map[t.project_id]) map[t.project_id].push(t)
    }
    return map
  }, [projects, filteredTasks])

  const postsByProject = useMemo(() => {
    const map: Record<string, Post[]> = {}
    for (const p of projects) map[p.id] = []
    for (const p of filteredPosts) {
      if (map[p.project_id]) map[p.project_id].push(p)
    }
    return map
  }, [projects, filteredPosts])

  const activeTaskProjects  = projects.filter(p => tasksByProject[p.id]?.length > 0)
  const activeIssueProjects = projects.filter(p => postsByProject[p.id]?.length > 0)

  const stats = useMemo(() => ({
    total:   activeTasks.length,
    overdue: activeTasks.filter(t => {
      if (!t.due_date || t.task_type === 'meeting') return false
      const d = new Date(t.due_date); d.setHours(0, 0, 0, 0)
      return d < today
    }).length,
    today: activeTasks.filter(t => {
      if (!t.due_date || t.task_type === 'meeting') return false
      const d = new Date(t.due_date); d.setHours(0, 0, 0, 0)
      return d.getTime() === today.getTime()
    }).length,
    urgent: activeTasks.filter(t => t.priority === 'urgent').length,
    high:   activeTasks.filter(t => t.priority === 'high').length,
  }), [activeTasks, today])

  const issueStats = useMemo(() => ({
    total:  allPosts.length,
    open:   allPosts.filter(p => p.type === 'issue' && p.status === 'open').length,
    closed: allPosts.filter(p => p.type === 'issue' && p.status === 'closed').length,
    note:   allPosts.filter(p => p.type === 'note').length,
  }), [allPosts])

  function toggleCollapse(projectId: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(projectId) ? next.delete(projectId) : next.add(projectId)
      return next
    })
  }

  const TASK_FILTERS: { key: FilterType; label: string; count: number; className: string }[] = [
    { key: 'all',     label: '전체',      count: stats.total,   className: 'text-gray-700' },
    { key: 'overdue', label: '기한 초과', count: stats.overdue, className: 'text-red-600' },
    { key: 'today',   label: '오늘 마감', count: stats.today,   className: 'text-orange-600' },
    { key: 'urgent',  label: '긴급',      count: stats.urgent,  className: 'text-red-600' },
    { key: 'high',    label: '높음 이상', count: stats.urgent + stats.high, className: 'text-orange-600' },
  ]

  const ISSUE_FILTERS: { key: IssueFilterType; label: string; count: number; className: string }[] = [
    { key: 'all',    label: '전체', count: issueStats.total,  className: 'text-gray-700' },
    { key: 'open',   label: '열림', count: issueStats.open,   className: 'text-blue-600' },
    { key: 'closed', label: '닫힘', count: issueStats.closed, className: 'text-gray-500' },
    { key: 'note',   label: '기록', count: issueStats.note,   className: 'text-purple-600' },
  ]

  function fmtDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">전체 현황</h1>
        <p className="text-sm text-gray-400">모든 프로젝트의 진행 상태</p>
      </div>

      {/* 뷰 탭 */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setView('tasks')}
          className={cn('flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
            view === 'tasks' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}
        >
          <CheckSquare size={14} /> 태스크 현황
        </button>
        <button
          onClick={() => setView('issues')}
          className={cn('flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
            view === 'issues' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}
        >
          <MessageSquare size={14} /> 이슈 & 기록
          {issueStats.open > 0 && (
            <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">
              {issueStats.open}
            </span>
          )}
        </button>
      </div>

      {/* ── 태스크 뷰 ── */}
      {view === 'tasks' && (
        <>
          <div className="flex items-center gap-2 mb-8 flex-wrap">
            {TASK_FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                  filter === f.key
                    ? 'bg-gray-900 text-white border-transparent'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                )}
              >
                {f.label}
                {f.count > 0 && (
                  <span className={cn(
                    'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                    filter === f.key ? 'bg-white/20 text-white' : 'bg-gray-100 ' + f.className
                  )}>
                    {f.count}
                  </span>
                )}
              </button>
            ))}
            <span className="ml-auto text-xs text-gray-400 flex items-center gap-1">
              <Layers size={12} /> {filteredTasks.length}개 표시 중
            </span>
          </div>

          {tasksLoading ? (
            <p className="text-gray-400 text-sm">불러오는 중...</p>
          ) : activeTaskProjects.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <CheckSquare size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">해당 조건의 태스크가 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeTaskProjects.map(p => {
                const tasks = tasksByProject[p.id]
                const isCollapsed = collapsed.has(p.id)
                const overdueCount = tasks.filter(t => {
                  if (!t.due_date || t.task_type === 'meeting') return false
                  const d = new Date(t.due_date); d.setHours(0, 0, 0, 0)
                  return d < today
                }).length
                const urgentCount = tasks.filter(t => t.priority === 'urgent').length

                return (
                  <div key={p.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                    <div
                      onClick={() => toggleCollapse(p.id)}
                      className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                      <span className="text-sm font-semibold flex-1">{p.name}</span>
                      <div className="flex items-center gap-2 mr-2">
                        <span className="text-xs text-gray-400">{tasks.length}개</span>
                        {urgentCount > 0 && (
                          <span className="flex items-center gap-0.5 text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full font-medium">
                            <Siren size={10} /> {urgentCount}
                          </span>
                        )}
                        {overdueCount > 0 && (
                          <span className="flex items-center gap-0.5 text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded-full font-medium">
                            <Clock size={10} /> {overdueCount}
                          </span>
                        )}
                      </div>
                      <span
                        onClick={e => { e.stopPropagation(); router.push(`/projects/${p.id}`) }}
                        className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors mr-1 cursor-pointer"
                      >
                        열기 →
                      </span>
                      {isCollapsed ? <ChevronRight size={14} className="text-gray-400 shrink-0" /> : <ChevronDown size={14} className="text-gray-400 shrink-0" />}
                    </div>

                    {!isCollapsed && (
                      <div className="divide-y divide-gray-50 border-t border-gray-100">
                        {tasks.map(task => {
                          const col = colMap[task.status]
                          const pm = PRIORITY_META[task.priority]
                          const isOverdue = task.due_date && task.task_type !== 'meeting' && (() => {
                            const d = new Date(task.due_date); d.setHours(0, 0, 0, 0)
                            return d < today
                          })()
                          const isToday = task.due_date && task.task_type !== 'meeting' && (() => {
                            const d = new Date(task.due_date); d.setHours(0, 0, 0, 0)
                            return d.getTime() === today.getTime()
                          })()
                          const checklist = task.checklist_items ?? []
                          const completedChecklist = checklist.filter(i => i.completed).length

                          return (
                            <button
                              key={task.id}
                              onClick={() => router.push(`/projects/${p.id}`)}
                              className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors text-left group"
                            >
                              <div className="w-1.5 h-1.5 rounded-full shrink-0 bg-gray-300 group-hover:bg-gray-500 transition-colors" />
                              <span className="flex-1 text-sm text-gray-700 truncate">{task.title}</span>
                              {col && <span className="text-[10px] text-gray-400 shrink-0 hidden sm:block">{col.name}</span>}
                              {checklist.length > 0 && (
                                <span className="text-[10px] text-gray-400 shrink-0 flex items-center gap-0.5">
                                  <CheckSquare size={10} /> {completedChecklist}/{checklist.length}
                                </span>
                              )}
                              {task.due_date && (
                                <span className={cn(
                                  'flex items-center gap-0.5 text-xs shrink-0',
                                  isOverdue ? 'text-red-500' : isToday ? 'text-orange-500' : 'text-gray-400'
                                )}>
                                  <CalendarDays size={11} />
                                  {isOverdue ? '기한 초과' : isToday ? '오늘 마감' :
                                    new Date(task.due_date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                                </span>
                              )}
                              {task.priority !== 'normal' && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${pm.className}`}>
                                  {pm.label}
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── 이슈 & 기록 뷰 ── */}
      {view === 'issues' && (
        <>
          <div className="flex items-center gap-2 mb-8 flex-wrap">
            {ISSUE_FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setIssueFilter(f.key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                  issueFilter === f.key
                    ? 'bg-gray-900 text-white border-transparent'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                )}
              >
                {f.label}
                {f.count > 0 && (
                  <span className={cn(
                    'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                    issueFilter === f.key ? 'bg-white/20 text-white' : 'bg-gray-100 ' + f.className
                  )}>
                    {f.count}
                  </span>
                )}
              </button>
            ))}
            <span className="ml-auto text-xs text-gray-400 flex items-center gap-1">
              <Layers size={12} /> {filteredPosts.length}개 표시 중
            </span>
          </div>

          {postsLoading ? (
            <p className="text-gray-400 text-sm">불러오는 중...</p>
          ) : activeIssueProjects.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <MessageSquare size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">해당 조건의 이슈/기록이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeIssueProjects.map(p => {
                const posts = postsByProject[p.id]
                const isCollapsed = collapsed.has(`issue-${p.id}`)
                const openCount = posts.filter(p => p.type === 'issue' && p.status === 'open').length

                return (
                  <div key={p.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                    <div
                      onClick={() => toggleCollapse(`issue-${p.id}`)}
                      className="w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                      <span className="text-sm font-semibold flex-1">{p.name}</span>
                      <div className="flex items-center gap-2 mr-2">
                        <span className="text-xs text-gray-400">{posts.length}개</span>
                        {openCount > 0 && (
                          <span className="flex items-center gap-0.5 text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full font-medium">
                            <AlertCircle size={10} /> 열림 {openCount}
                          </span>
                        )}
                      </div>
                      <Link
                        href={`/projects/${p.id}/issues`}
                        onClick={e => e.stopPropagation()}
                        className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors mr-1"
                      >
                        이슈 페이지 →
                      </Link>
                      {isCollapsed ? <ChevronRight size={14} className="text-gray-400 shrink-0" /> : <ChevronDown size={14} className="text-gray-400 shrink-0" />}
                    </div>

                    {!isCollapsed && (
                      <div className="divide-y divide-gray-50 border-t border-gray-100">
                        {posts.map(post => {
                          const isNote = post.type === 'note'
                          const isOpen = post.status === 'open'
                          const pm = PRIORITY_META[post.priority]

                          return (
                            <Link
                              key={post.id}
                              href={`/projects/${p.id}/issues`}
                              className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors"
                            >
                              {isNote
                                ? <FileText size={13} className="text-purple-400 shrink-0" />
                                : <MessageSquare size={13} className={cn('shrink-0', isOpen ? 'text-blue-500' : 'text-gray-400')} />
                              }
                              <span className="flex-1 text-sm text-gray-700 truncate">{post.title}</span>
                              {isNote ? (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 font-medium shrink-0">기록</span>
                              ) : (
                                <span className={cn(
                                  'text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0',
                                  isOpen ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
                                )}>
                                  {isOpen ? '열림' : '닫힘'}
                                </span>
                              )}
                              {!isNote && post.priority !== 'normal' && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${pm.className}`}>
                                  {pm.label}
                                </span>
                              )}
                              <span className="text-[10px] text-gray-400 shrink-0">{fmtDate(post.created_at)}</span>
                            </Link>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
