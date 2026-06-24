'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { Task, Post } from '@/types'
import { useProjects } from '@/hooks/useProjects'
import { useAllColumns } from '@/hooks/useAllColumns'
import { PRIORITY_META } from '@/lib/constants'
import { CheckCircle2, Plus, AlertCircle, TrendingUp, Calendar, FolderKanban, Clock, MessageSquare, FileText, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import CompletionBarChart from '@/components/report/CompletionBarChart'

const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일']

function getWeekRange(offset = 0) {
  const now = new Date()
  const day = now.getDay()
  const diffToMon = (day === 0 ? -6 : 1 - day)
  const mon = new Date(now); mon.setDate(now.getDate() + diffToMon + offset * 7); mon.setHours(0, 0, 0, 0)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23, 59, 59, 999)
  return { start: mon, end: sun }
}

function getMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  return { start, end }
}

function fmt(date: Date) {
  return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
}

function toDateKey(dateStr: string) {
  return dateStr.split('T')[0]
}

function localDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function WeeklyReportPage() {
  const router = useRouter()
  const [weekOffset, setWeekOffset] = useState(0)
  const [chartView, setChartView] = useState<'weekly' | 'monthly'>('weekly')
  const { start, end } = useMemo(() => getWeekRange(weekOffset), [weekOffset])
  const todayKey = localDateKey(new Date())
  const { start: monthStart, end: monthEnd } = useMemo(() => getMonthRange(), [])

  const { data: projects = [] } = useProjects()
  const { data: columns = [] } = useAllColumns()

  const { data: weekTasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['weekly-report-tasks', start.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, checklist_items(*)')
        .is('deleted_at', null)
        .eq('archived', false)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
      if (error) throw error
      return data
    },
  })

  const { data: completedTasks = [] } = useQuery<Task[]>({
    queryKey: ['weekly-completed-tasks', start.toISOString()],
    queryFn: async () => {
      const doneColRes = await supabase.from('columns').select('id').eq('name', '완료')
      const doneIds = (doneColRes.data ?? []).map(c => c.id)
      if (doneIds.length === 0) return []
      const { data, error } = await supabase
        .from('tasks')
        .select('*, checklist_items(*)')
        .is('deleted_at', null)
        .eq('archived', false)
        .in('status', doneIds)
        .gte('updated_at', start.toISOString())
        .lte('updated_at', end.toISOString())
      if (error) throw error
      return data
    },
  })

  const { data: weeklyPosts = [] } = useQuery<Post[]>({
    queryKey: ['weekly-posts', start.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('id, project_id, type, title, status, priority, tags, created_at')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: false })
      if (error) {
        if (error.code === '42P01' || error.message?.includes('posts')) return []
        throw error
      }
      return data ?? []
    },
  })

  const { data: overdueTasks = [] } = useQuery<Task[]>({
    queryKey: ['weekly-overdue-tasks'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0]
      const doneColRes = await supabase.from('columns').select('id').eq('name', '완료')
      const doneIds = new Set((doneColRes.data ?? []).map(c => c.id))
      const { data, error } = await supabase
        .from('tasks')
        .select('*, checklist_items(*)')
        .is('deleted_at', null)
        .eq('archived', false)
        .not('due_date', 'is', null)
        .lt('due_date', today)
      if (error) throw error
      return (data ?? []).filter(t => !doneIds.has(t.status))
    },
  })

  const { data: monthCompletedTasks = [] } = useQuery<{ id: string; updated_at: string }[]>({
    queryKey: ['monthly-completed-tasks', monthStart.toISOString()],
    enabled: chartView === 'monthly',
    queryFn: async () => {
      const doneColRes = await supabase.from('columns').select('id').eq('name', '완료')
      const doneIds = (doneColRes.data ?? []).map(c => c.id)
      if (doneIds.length === 0) return []
      const { data, error } = await supabase
        .from('tasks')
        .select('id, updated_at')
        .is('deleted_at', null)
        .eq('archived', false)
        .in('status', doneIds)
        .gte('updated_at', monthStart.toISOString())
        .lte('updated_at', monthEnd.toISOString())
      if (error) throw error
      return (data ?? []) as { id: string; updated_at: string }[]
    },
  })

  const { data: monthCreatedTasks = [] } = useQuery<{ id: string; created_at: string }[]>({
    queryKey: ['monthly-created-tasks', monthStart.toISOString()],
    enabled: chartView === 'monthly',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, created_at')
        .is('deleted_at', null)
        .eq('archived', false)
        .gte('created_at', monthStart.toISOString())
        .lte('created_at', monthEnd.toISOString())
      if (error) throw error
      return (data ?? []) as { id: string; created_at: string }[]
    },
  })

  const projMap = useMemo(() => Object.fromEntries(projects.map(p => [p.id, p])), [projects])
  const doneColumnIds = useMemo(() => new Set(columns.filter(c => c.name === '완료').map(c => c.id)), [columns])

  // 7일 배열 (월~일)
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  }), [start])

  // 요일별 태스크 그루핑
  const tasksByDay = useMemo(() => {
    const map: Record<string, { completed: Task[]; created: Task[] }> = {}
    days.forEach(d => { map[localDateKey(d)] = { completed: [], created: [] } })
    for (const t of completedTasks) {
      const key = localDateKey(new Date(t.updated_at))
      if (map[key]) map[key].completed.push(t)
    }
    for (const t of weekTasks) {
      const key = localDateKey(new Date(t.created_at))
      if (map[key]) map[key].created.push(t)
    }
    return map
  }, [days, completedTasks, weekTasks])

  const byProject = useMemo(() => {
    const map: Record<string, { created: Task[]; completed: Task[]; overdue: Task[]; posts: Post[] }> = {}
    for (const p of projects) map[p.id] = { created: [], completed: [], overdue: [], posts: [] }
    for (const t of weekTasks) map[t.project_id]?.created.push(t)
    for (const t of completedTasks) map[t.project_id]?.completed.push(t)
    for (const t of overdueTasks) map[t.project_id]?.overdue.push(t)
    for (const p of weeklyPosts) map[p.project_id]?.posts.push(p)
    return map
  }, [projects, weekTasks, completedTasks, overdueTasks, weeklyPosts])

  const activeProjects = projects.filter(p => {
    const ps = byProject[p.id]
    return ps && (ps.created.length + ps.completed.length + ps.overdue.length + ps.posts.length) > 0
  })

  const weeklyChartData = useMemo(() =>
    days.map((d, i) => ({
      label: DAY_LABELS[i],
      completed: tasksByDay[localDateKey(d)]?.completed.length ?? 0,
      created: tasksByDay[localDateKey(d)]?.created.length ?? 0,
    })),
    [days, tasksByDay]
  )

  const todayDayIndex = useMemo(() =>
    days.findIndex(d => localDateKey(d) === todayKey),
    [days, todayKey]
  )

  const monthlyChartData = useMemo(() => {
    const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate()
    const weekCount = Math.ceil(daysInMonth / 7)
    const weeks = Array.from({ length: weekCount }, (_, i) => ({ label: `${i + 1}주`, completed: 0, created: 0 }))
    for (const t of monthCompletedTasks) {
      const day = new Date(t.updated_at).getDate()
      const weekIdx = Math.min(Math.ceil(day / 7) - 1, weekCount - 1)
      weeks[weekIdx].completed++
    }
    for (const t of monthCreatedTasks) {
      const day = new Date(t.created_at).getDate()
      const weekIdx = Math.min(Math.ceil(day / 7) - 1, weekCount - 1)
      weeks[weekIdx].created++
    }
    return weeks
  }, [monthCompletedTasks, monthCreatedTasks, monthStart])

  const currentWeekIndex = Math.min(Math.ceil(new Date().getDate() / 7) - 1, 4)

  function DayTaskItem({ task, type }: { task: Task; type: 'completed' | 'created' }) {
    const proj = projMap[task.project_id]
    return (
      <button
        onClick={() => router.push(`/projects/${task.project_id}`)}
        className={cn(
          'w-full text-left flex items-start gap-1.5 py-1 px-1.5 rounded transition-colors group',
          type === 'completed'
            ? 'bg-green-50 dark:bg-green-900/10 hover:bg-green-100 dark:hover:bg-green-900/20'
            : 'bg-blue-50 dark:bg-blue-900/10 hover:bg-blue-100 dark:hover:bg-blue-900/20'
        )}
      >
        {type === 'completed'
          ? <CheckCircle2 size={10} className="text-green-500 shrink-0 mt-0.5" />
          : <Plus size={10} className="text-blue-500 shrink-0 mt-0.5" />
        }
        <span className={cn('text-[11px] leading-tight break-words min-w-0',
          type === 'completed'
            ? 'line-through text-gray-400 dark:text-gray-500'
            : 'text-gray-700 dark:text-gray-300'
        )}>
          {task.title}
        </span>
      </button>
    )
  }

  function TaskRow({ task }: { task: Task }) {
    const proj = projMap[task.project_id]
    const isDone = doneColumnIds.has(task.status)
    const pm = PRIORITY_META[task.priority]
    return (
      <button
        onClick={() => router.push(`/projects/${task.project_id}`)}
        className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group"
      >
        {isDone
          ? <CheckCircle2 size={14} className="text-green-500 shrink-0" />
          : <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 shrink-0" />
        }
        <span className={`flex-1 text-sm ${isDone ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}>
          {task.title}
        </span>
        {task.priority !== 'normal' && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${pm.className}`}>
            {pm.label}
          </span>
        )}
        {proj && (
          <span className="flex items-center gap-1 text-[10px] text-gray-400 shrink-0 group-hover:text-gray-600">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: proj.color }} />
            {proj.name}
          </span>
        )}
      </button>
    )
  }

  const isEmpty = weekTasks.length === 0 && completedTasks.length === 0 && overdueTasks.length === 0

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 mb-1">
            <Calendar size={13} />
            {fmt(start)} – {fmt(end)}
            {weekOffset === 0 && (
              <span className="bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full font-medium">이번 주</span>
            )}
          </div>
          <h1 className="text-2xl font-bold dark:text-gray-100">주간 리포트</h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekOffset(v => v - 1)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-400"
          >
            <ChevronLeft size={14} /> 이전 주
          </button>
          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-500 dark:text-gray-400"
            >
              이번 주
            </button>
          )}
          <button
            onClick={() => setWeekOffset(v => v + 1)}
            disabled={weekOffset >= 0}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-400 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            다음 주 <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-gray-400 text-sm">불러오는 중...</p>
      ) : isEmpty ? (
        <div className="text-center py-20 text-gray-400">
          <TrendingUp size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">이번 주 활동이 없습니다.</p>
        </div>
      ) : (
        <>
          {/* 요약 카드 */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-center">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mx-auto mb-2">
                <Plus size={15} className="text-blue-500" />
              </div>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{weekTasks.length}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">이번 주 생성</p>
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-center">
              <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 size={15} className="text-green-500" />
              </div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{completedTasks.length}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">이번 주 완료</p>
            </div>
            <div className={cn('border rounded-xl p-4 text-center',
              overdueTasks.length > 0
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
            )}>
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-2',
                overdueTasks.length > 0 ? 'bg-red-100 dark:bg-red-900/40' : 'bg-gray-50 dark:bg-gray-700'
              )}>
                <AlertCircle size={15} className={overdueTasks.length > 0 ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'} />
              </div>
              <p className={cn('text-2xl font-bold', overdueTasks.length > 0 ? 'text-red-600 dark:text-red-400' : 'dark:text-gray-100')}>{overdueTasks.length}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">기한 초과</p>
            </div>
          </div>

          {/* 이슈/기록 요약 카드 */}
          {weeklyPosts.length > 0 && (
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-center">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mx-auto mb-2">
                  <MessageSquare size={15} className="text-blue-500" />
                </div>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {weeklyPosts.filter(p => p.type === 'issue').length}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">이슈 등록</p>
              </div>
              <div className={cn('border rounded-xl p-4 text-center',
                weeklyPosts.filter(p => p.type === 'issue' && p.status === 'open').length > 0
                  ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
              )}>
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-2',
                  weeklyPosts.filter(p => p.type === 'issue' && p.status === 'open').length > 0
                    ? 'bg-orange-100 dark:bg-orange-900/40'
                    : 'bg-gray-50 dark:bg-gray-700'
                )}>
                  <AlertCircle size={15} className={
                    weeklyPosts.filter(p => p.type === 'issue' && p.status === 'open').length > 0
                      ? 'text-orange-500'
                      : 'text-gray-400 dark:text-gray-500'
                  } />
                </div>
                <p className={cn('text-2xl font-bold',
                  weeklyPosts.filter(p => p.type === 'issue' && p.status === 'open').length > 0
                    ? 'text-orange-600 dark:text-orange-400'
                    : 'dark:text-gray-100'
                )}>
                  {weeklyPosts.filter(p => p.type === 'issue' && p.status === 'open').length}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">미해결 이슈</p>
              </div>
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-center">
                <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center mx-auto mb-2">
                  <FileText size={15} className="text-purple-500" />
                </div>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {weeklyPosts.filter(p => p.type === 'note').length}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">기록 작성</p>
              </div>
            </div>
          )}

          {/* 생성/완료 추이 차트 */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-8">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">생성 / 완료 추이</p>
                <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-gray-500">
                  <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-blue-300 dark:bg-blue-400"></span>생성</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-green-300 dark:bg-green-400"></span>완료</span>
                </div>
              </div>
              <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
                <button
                  onClick={() => setChartView('weekly')}
                  className={cn('px-2.5 py-1 text-xs rounded-md transition-colors font-medium',
                    chartView === 'weekly'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  )}
                >주간</button>
                <button
                  onClick={() => setChartView('monthly')}
                  className={cn('px-2.5 py-1 text-xs rounded-md transition-colors font-medium',
                    chartView === 'monthly'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  )}
                >월간</button>
              </div>
            </div>
            <CompletionBarChart
              data={chartView === 'weekly' ? weeklyChartData : monthlyChartData}
              highlightIndex={chartView === 'weekly' ? todayDayIndex : currentWeekIndex}
            />
          </div>

          {/* 요일별 그리드 */}
          <div className="grid grid-cols-7 gap-2 mb-8">
            {days.map((day, i) => {
              const key = localDateKey(day)
              const dayData = tasksByDay[key] ?? { completed: [], created: [] }
              const isToday = key === todayKey
              const isWeekend = i >= 5
              const hasActivity = dayData.completed.length > 0 || dayData.created.length > 0

              return (
                <div key={key} className={cn(
                  'rounded-xl border p-3 min-h-[180px] transition-colors',
                  isToday
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700',
                  !hasActivity && 'opacity-60'
                )}>
                  <div className="text-center mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
                    <p className={cn('text-[11px] font-medium',
                      isWeekend ? 'text-red-400 dark:text-red-500' : 'text-gray-400 dark:text-gray-500'
                    )}>
                      {DAY_LABELS[i]}
                    </p>
                    <p className={cn('text-base font-bold mt-0.5',
                      isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'
                    )}>
                      {day.getDate()}
                    </p>
                  </div>

                  {dayData.completed.length > 0 && (
                    <div className="mb-2">
                      <p className="text-[10px] font-medium text-green-600 dark:text-green-500 mb-1 flex items-center gap-0.5">
                        <CheckCircle2 size={9} /> 완료 {dayData.completed.length}
                      </p>
                      <div className="space-y-0.5">
                        {dayData.completed.map(t => <DayTaskItem key={t.id} task={t} type="completed" />)}
                      </div>
                    </div>
                  )}

                  {dayData.created.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-blue-600 dark:text-blue-400 mb-1 flex items-center gap-0.5">
                        <Plus size={9} /> 생성 {dayData.created.length}
                      </p>
                      <div className="space-y-0.5">
                        {dayData.created.map(t => <DayTaskItem key={t.id} task={t} type="created" />)}
                      </div>
                    </div>
                  )}

                  {!hasActivity && (
                    <p className="text-[11px] text-gray-300 dark:text-gray-600 text-center mt-6">–</p>
                  )}
                </div>
              )
            })}
          </div>

          {/* 하단: 기한초과 + 이슈/기록 + 프로젝트별 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {overdueTasks.length > 0 && (
                <section>
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-red-600 mb-3">
                    <AlertCircle size={14} /> 기한 초과 ({overdueTasks.length})
                  </h2>
                  <div className="bg-white dark:bg-gray-800 border border-red-100 dark:border-red-900/50 rounded-xl overflow-hidden divide-y divide-gray-50 dark:divide-gray-700">
                    {overdueTasks.map(t => <TaskRow key={t.id} task={t} />)}
                  </div>
                </section>
              )}

              {weeklyPosts.length > 0 && (
                <section>
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-purple-600 mb-3">
                    <MessageSquare size={14} /> 이번 주 이슈/기록 ({weeklyPosts.length})
                  </h2>
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden divide-y divide-gray-50 dark:divide-gray-700">
                    {weeklyPosts.map(post => {
                      const proj = projMap[post.project_id]
                      const isNote = post.type === 'note'
                      const isOpen = post.status === 'open'
                      const pm = PRIORITY_META[post.priority as keyof typeof PRIORITY_META]
                      return (
                        <Link key={post.id} href={`/projects/${post.project_id}/issues`}
                          className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          {isNote
                            ? <FileText size={14} className="text-purple-400 shrink-0" />
                            : <MessageSquare size={14} className={isOpen ? 'text-blue-500 shrink-0' : 'text-gray-400 shrink-0'} />
                          }
                          <span className="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">{post.title}</span>
                          {isNote ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 font-medium shrink-0">기록</span>
                          ) : (
                            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0',
                              isOpen ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                            )}>
                              {isOpen ? '열림' : '닫힘'}
                            </span>
                          )}
                          {!isNote && post.priority !== 'normal' && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${pm.className}`}>{pm.label}</span>
                          )}
                          {proj && (
                            <span className="flex items-center gap-1 text-[10px] text-gray-400 shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: proj.color }} />
                              {proj.name}
                            </span>
                          )}
                        </Link>
                      )
                    })}
                  </div>
                </section>
              )}
            </div>

            {activeProjects.length > 0 && (
              <div className="lg:col-span-1">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  <FolderKanban size={14} /> 프로젝트별 현황
                </h2>
                <div className="space-y-2 lg:sticky lg:top-8">
                  {activeProjects.map(p => {
                    const ps = byProject[p.id]
                    return (
                      <button key={p.id} onClick={() => router.push(`/projects/${p.id}`)}
                        className="w-full text-left bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                          <span className="text-sm font-semibold truncate dark:text-gray-100">{p.name}</span>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
                          {ps.created.length > 0 && (
                            <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                              <Plus size={11} /> {ps.created.length}개 생성
                            </span>
                          )}
                          {ps.completed.length > 0 && (
                            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                              <CheckCircle2 size={11} /> {ps.completed.length}개 완료
                            </span>
                          )}
                          {ps.overdue.length > 0 && (
                            <span className="flex items-center gap-1 text-red-500">
                              <Clock size={11} /> {ps.overdue.length}개 기한초과
                            </span>
                          )}
                          {ps.posts.length > 0 && (
                            <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                              <MessageSquare size={11} /> {ps.posts.filter(p => p.type === 'issue').length}개 이슈
                              {ps.posts.filter(p => p.type === 'note').length > 0 && (
                                <> · {ps.posts.filter(p => p.type === 'note').length}개 기록</>
                              )}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
