'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { Task, Project, ProjectColumn } from '@/types'
import { CheckCircle2, Plus, AlertCircle, TrendingUp, Calendar, FolderKanban, Clock } from 'lucide-react'

const PRIORITY_META: Record<string, { label: string; className: string }> = {
  low:    { label: '낮음', className: 'bg-gray-100 text-gray-500' },
  normal: { label: '보통', className: 'bg-blue-100 text-blue-600' },
  high:   { label: '높음', className: 'bg-orange-100 text-orange-600' },
  urgent: { label: '긴급', className: 'bg-red-100 text-red-600' },
}

function getWeekRange() {
  const now = new Date()
  const day = now.getDay() // 0=일, 1=월 ...
  const diffToMon = (day === 0 ? -6 : 1 - day)
  const mon = new Date(now); mon.setDate(now.getDate() + diffToMon); mon.setHours(0, 0, 0, 0)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23, 59, 59, 999)
  return { start: mon, end: sun }
}

function fmt(date: Date) {
  return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
}

export default function WeeklyReportPage() {
  const router = useRouter()
  const { start, end } = useMemo(getWeekRange, [])

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').is('deleted_at', null).eq('archived', false)
      if (error) throw error
      return data
    },
  })

  const { data: columns = [] } = useQuery<ProjectColumn[]>({
    queryKey: ['all-columns-report'],
    queryFn: async () => {
      const { data, error } = await supabase.from('columns').select('*')
      if (error) throw error
      return data
    },
  })

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

  // 이번 주 완료된 태스크 (updated_at 기준)
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

  // 기한 초과 태스크
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

  const projMap = useMemo(() => Object.fromEntries(projects.map(p => [p.id, p])), [projects])
  const doneColumnIds = useMemo(() => new Set(columns.filter(c => c.name === '완료').map(c => c.id)), [columns])

  const byProject = useMemo(() => {
    const map: Record<string, { created: Task[]; completed: Task[]; overdue: Task[] }> = {}
    for (const p of projects) map[p.id] = { created: [], completed: [], overdue: [] }
    for (const t of weekTasks) map[t.project_id]?.created.push(t)
    for (const t of completedTasks) map[t.project_id]?.completed.push(t)
    for (const t of overdueTasks) map[t.project_id]?.overdue.push(t)
    return map
  }, [projects, weekTasks, completedTasks, overdueTasks])

  const activeProjects = projects.filter(p => {
    const ps = byProject[p.id]
    return ps && (ps.created.length + ps.completed.length + ps.overdue.length) > 0
  })

  function TaskRow({ task }: { task: Task }) {
    const proj = projMap[task.project_id]
    const isDone = doneColumnIds.has(task.status)
    const pm = PRIORITY_META[task.priority]
    return (
      <button
        onClick={() => router.push(`/projects/${task.project_id}`)}
        className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
      >
        {isDone
          ? <CheckCircle2 size={14} className="text-green-500 shrink-0" />
          : <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 shrink-0" />
        }
        <span className={`flex-1 text-sm ${isDone ? 'line-through text-gray-400' : 'text-gray-700'}`}>
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

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* 헤더 */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
          <Calendar size={13} />
          {fmt(start)} – {fmt(end)}
        </div>
        <h1 className="text-2xl font-bold">주간 리포트</h1>
      </div>

      {isLoading ? (
        <p className="text-gray-400 text-sm">불러오는 중...</p>
      ) : (
        <>
          {/* 요약 카드 */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center mx-auto mb-2">
                <Plus size={15} className="text-blue-500" />
              </div>
              <p className="text-2xl font-bold">{weekTasks.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">이번 주 생성</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 size={15} className="text-green-500" />
              </div>
              <p className="text-2xl font-bold text-green-600">{completedTasks.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">이번 주 완료</p>
            </div>
            <div className={`border rounded-xl p-4 text-center ${overdueTasks.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-2 ${overdueTasks.length > 0 ? 'bg-red-100' : 'bg-gray-50'}`}>
                <AlertCircle size={15} className={overdueTasks.length > 0 ? 'text-red-500' : 'text-gray-400'} />
              </div>
              <p className={`text-2xl font-bold ${overdueTasks.length > 0 ? 'text-red-600' : ''}`}>{overdueTasks.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">기한 초과</p>
            </div>
          </div>

          {/* 기한 초과 태스크 */}
          {overdueTasks.length > 0 && (
            <section className="mb-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-red-600 mb-3">
                <AlertCircle size={14} /> 기한 초과 ({overdueTasks.length})
              </h2>
              <div className="bg-white border border-red-100 rounded-xl overflow-hidden divide-y divide-gray-50">
                {overdueTasks.map(t => <TaskRow key={t.id} task={t} />)}
              </div>
            </section>
          )}

          {/* 이번 주 완료 */}
          {completedTasks.length > 0 && (
            <section className="mb-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-green-600 mb-3">
                <CheckCircle2 size={14} /> 이번 주 완료 ({completedTasks.length})
              </h2>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-50">
                {completedTasks.map(t => <TaskRow key={t.id} task={t} />)}
              </div>
            </section>
          )}

          {/* 이번 주 생성 */}
          {weekTasks.length > 0 && (
            <section className="mb-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-blue-600 mb-3">
                <Plus size={14} /> 이번 주 생성 ({weekTasks.length})
              </h2>
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-50">
                {weekTasks.map(t => <TaskRow key={t.id} task={t} />)}
              </div>
            </section>
          )}

          {/* 프로젝트별 요약 */}
          {activeProjects.length > 0 && (
            <section>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                <FolderKanban size={14} /> 프로젝트별 현황
              </h2>
              <div className="space-y-3">
                {activeProjects.map(p => {
                  const ps = byProject[p.id]
                  return (
                    <button
                      key={p.id}
                      onClick={() => router.push(`/projects/${p.id}`)}
                      className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                        <span className="text-sm font-semibold">{p.name}</span>
                      </div>
                      <div className="flex gap-4 text-xs text-gray-500">
                        {ps.created.length > 0 && (
                          <span className="flex items-center gap-1 text-blue-600">
                            <Plus size={11} /> {ps.created.length}개 생성
                          </span>
                        )}
                        {ps.completed.length > 0 && (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 size={11} /> {ps.completed.length}개 완료
                          </span>
                        )}
                        {ps.overdue.length > 0 && (
                          <span className="flex items-center gap-1 text-red-500">
                            <Clock size={11} /> {ps.overdue.length}개 기한초과
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {weekTasks.length === 0 && completedTasks.length === 0 && overdueTasks.length === 0 && (
            <div className="text-center py-20 text-gray-400">
              <TrendingUp size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">이번 주 활동이 없습니다.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
