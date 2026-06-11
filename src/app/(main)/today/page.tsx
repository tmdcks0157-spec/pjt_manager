'use client'

import { useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { Task, Project, ProjectColumn } from '@/types'
import {
  Sun, Square, CalendarDays, Clock, Siren,
  TrendingUp, Users, ChevronRight, CheckCircle2, CheckSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const PRIORITY_META: Record<string, { label: string; className: string }> = {
  low:    { label: '낮음', className: 'bg-gray-100 text-gray-500' },
  normal: { label: '보통', className: 'bg-blue-100 text-blue-600' },
  high:   { label: '높음', className: 'bg-orange-100 text-orange-600' },
  urgent: { label: '긴급', className: 'bg-red-100 text-red-600' },
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return '좋은 아침이에요 ☀️'
  if (h < 18) return '좋은 오후예요 🌤️'
  return '좋은 저녁이에요 🌙'
}

function fmtToday() {
  return new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
}

export default function TodayPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').is('deleted_at', null).eq('archived', false)
      if (error) throw error
      return data
    },
  })

  const { data: columns = [] } = useQuery<ProjectColumn[]>({
    queryKey: ['all-columns-today'],
    queryFn: async () => {
      const { data, error } = await supabase.from('columns').select('*')
      if (error) throw error
      return data
    },
  })

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['today-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, checklist_items(*)')
        .is('deleted_at', null)
        .eq('archived', false)
      if (error) throw error
      return data
    },
  })

  const doneColIds = useMemo(
    () => new Set(columns.filter(c => c.name === '완료').map(c => c.id)),
    [columns]
  )

  const doneColByProject = useMemo(() => {
    const map: Record<string, string> = {}
    for (const c of columns) {
      if (c.name === '완료') map[c.project_id] = c.id
    }
    return map
  }, [columns])

  const projMap = useMemo(
    () => Object.fromEntries(projects.map(p => [p.id, p])),
    [projects]
  )

  const today = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d
  }, [])

  const activeTasks = useMemo(
    () => tasks.filter(t => !doneColIds.has(t.status)),
    [tasks, doneColIds]
  )

  const todayMeetings = useMemo(() => activeTasks.filter(t => {
    if (t.task_type !== 'meeting' || !t.due_date) return false
    const d = new Date(t.due_date); d.setHours(0, 0, 0, 0)
    return d.getTime() === today.getTime()
  }), [activeTasks, today])

  const todayTasks = useMemo(() => activeTasks.filter(t => {
    if (t.task_type === 'meeting' || !t.due_date) return false
    const d = new Date(t.due_date); d.setHours(0, 0, 0, 0)
    return d.getTime() === today.getTime()
  }), [activeTasks, today])

  const overdueTasks = useMemo(() => activeTasks.filter(t => {
    if (!t.due_date || t.task_type === 'meeting') return false
    const d = new Date(t.due_date); d.setHours(0, 0, 0, 0)
    return d < today
  }), [activeTasks, today])

  const urgentTasks = useMemo(() => activeTasks.filter(t => {
    if (t.priority !== 'urgent') return false
    if (!t.due_date) return true
    const d = new Date(t.due_date); d.setHours(0, 0, 0, 0)
    return d > today
  }), [activeTasks, today])

  const doneMutation = useMutation({
    mutationFn: async (task: Task) => {
      const doneColId = doneColByProject[task.project_id]
      if (!doneColId) throw new Error('완료 컬럼 없음')
      const { error } = await supabase.from('tasks').update({ status: doneColId }).eq('id', task.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      queryClient.invalidateQueries({ queryKey: ['overview-tasks'] })
    },
  })

  const totalToday = todayTasks.length + todayMeetings.length
  const isEmpty = totalToday === 0 && overdueTasks.length === 0 && urgentTasks.length === 0

  function TaskRow({ task }: { task: Task }) {
    const proj = projMap[task.project_id]
    const pm = PRIORITY_META[task.priority]
    const hasDoneCol = !!doneColByProject[task.project_id]
    const checklist = task.checklist_items ?? []
    const completed = checklist.filter(i => i.completed).length

    return (
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group">
        <button
          onClick={() => hasDoneCol && doneMutation.mutate(task)}
          disabled={!hasDoneCol}
          className={cn(
            'shrink-0 transition-colors',
            hasDoneCol ? 'text-gray-300 hover:text-green-500 cursor-pointer' : 'text-gray-200 cursor-default'
          )}
          title={hasDoneCol ? '완료 처리' : '완료 컬럼 없음'}
        >
          <Square size={16} />
        </button>

        <button
          onClick={() => router.push(`/projects/${task.project_id}`)}
          className="flex-1 text-left flex items-center gap-2 min-w-0"
        >
          {proj && (
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: proj.color }} />
          )}
          <span className="text-sm text-gray-800 truncate">{task.title}</span>
        </button>

        <div className="flex items-center gap-1.5 shrink-0">
          {checklist.length > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
              <CheckSquare size={10} /> {completed}/{checklist.length}
            </span>
          )}
          {task.priority !== 'normal' && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${pm.className}`}>
              {pm.label}
            </span>
          )}
          {proj && (
            <span className="text-[10px] text-gray-400 hidden sm:block">{proj.name}</span>
          )}
          <ChevronRight
            size={13}
            className="text-gray-300 group-hover:text-gray-500 transition-colors"
          />
        </div>
      </div>
    )
  }

  function Section({
    title, icon, count, tasks, accent,
  }: {
    title: string
    icon: React.ReactNode
    count: number
    tasks: Task[]
    accent: string
  }) {
    if (tasks.length === 0) return null
    return (
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className={`flex items-center gap-2 px-4 py-3 border-b border-gray-100`}>
          {icon}
          <span className={`text-sm font-semibold ${accent}`}>{title}</span>
          <span className="ml-auto text-xs text-gray-400 font-medium">{count}개</span>
        </div>
        <div className="divide-y divide-gray-50">
          {tasks.map(t => <TaskRow key={t.id} task={t} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      {/* 헤더 */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
          <Sun size={14} />
          {fmtToday()}
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{getGreeting()}</h1>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-3 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{totalToday}</p>
          <p className="text-xs text-gray-400 mt-0.5">오늘 할 일</p>
        </div>
        <div className={cn(
          'border rounded-xl p-4 text-center',
          overdueTasks.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'
        )}>
          <p className={`text-2xl font-bold ${overdueTasks.length > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {overdueTasks.length}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">기한 초과</p>
        </div>
        <div className={cn(
          'border rounded-xl p-4 text-center',
          urgentTasks.length > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200'
        )}>
          <p className={`text-2xl font-bold ${urgentTasks.length > 0 ? 'text-orange-600' : 'text-gray-900'}`}>
            {urgentTasks.length}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">긴급</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-indigo-600">{todayMeetings.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">오늘 일정</p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-gray-400 text-sm">불러오는 중...</p>
      ) : isEmpty ? (
        <div className="text-center py-20 text-gray-400">
          <CheckCircle2 size={48} className="mx-auto mb-4 text-green-400" />
          <p className="text-lg font-semibold text-gray-600">오늘 할 일이 없어요!</p>
          <p className="text-sm mt-1">여유로운 하루를 보내세요 😊</p>
        </div>
      ) : (
        <div className="space-y-4">
          <Section
            title="오늘 일정"
            icon={<Users size={14} className="text-indigo-500" />}
            count={todayMeetings.length}
            tasks={todayMeetings}
            accent="text-indigo-600"
          />
          <Section
            title="오늘 마감"
            icon={<CalendarDays size={14} className="text-orange-500" />}
            count={todayTasks.length}
            tasks={todayTasks}
            accent="text-orange-600"
          />
          <Section
            title="기한 초과"
            icon={<Clock size={14} className="text-red-500" />}
            count={overdueTasks.length}
            tasks={overdueTasks}
            accent="text-red-600"
          />
          <Section
            title="긴급 태스크"
            icon={<Siren size={14} className="text-red-500" />}
            count={urgentTasks.length}
            tasks={urgentTasks}
            accent="text-red-600"
          />
        </div>
      )}
    </div>
  )
}
