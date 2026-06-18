'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { Task, Project, ProjectColumn } from '@/types'
import { CheckCircle2, Plus, AlertCircle, TrendingUp, Calendar, FolderKanban, Clock, MessageSquare, FileText, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'

interface Post {
  id: string
  project_id: string
  type: 'issue' | 'note'
  title: string
  status: 'open' | 'closed'
  priority: string
  created_at: string
}

const PRIORITY_META: Record<string, { label: string; className: string }> = {
  low:    { label: '낮음', className: 'bg-gray-100 text-gray-500' },
  normal: { label: '보통', className: 'bg-blue-100 text-blue-600' },
  high:   { label: '높음', className: 'bg-orange-100 text-orange-600' },
  urgent: { label: '긴급', className: 'bg-red-100 text-red-600' },
}

function getWeekRange(offset = 0) {
  const now = new Date()
  const day = now.getDay()
  const diffToMon = (day === 0 ? -6 : 1 - day)
  const mon = new Date(now); mon.setDate(now.getDate() + diffToMon + offset * 7); mon.setHours(0, 0, 0, 0)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23, 59, 59, 999)
  return { start: mon, end: sun }
}

function fmt(date: Date) {
  return date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
}

export default function WeeklyReportPage() {
  const router = useRouter()
  const [weekOffset, setWeekOffset] = useState(0)
  const { start, end } = useMemo(() => getWeekRange(weekOffset), [weekOffset])

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

  // 이번 주 이슈/기록
  const { data: weeklyPosts = [] } = useQuery<Post[]>({
    queryKey: ['weekly-posts', start.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('id, project_id, type, title, status, priority, created_at')
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
    <div className="p-8 max-w-6xl mx-auto">
      {/* 헤더 */}
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
            <Calendar size={13} />
            {fmt(start)} – {fmt(end)}
            {weekOffset === 0 && (
              <span className="bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full font-medium">이번 주</span>
            )}
          </div>
          <h1 className="text-2xl font-bold">주간 리포트</h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekOffset(v => v - 1)}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
          >
            <ChevronLeft size={14} /> 이전 주
          </button>
          {weekOffset !== 0 && (
            <button
              onClick={() => setWeekOffset(0)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-500"
            >
              이번 주
            </button>
          )}
          <button
            onClick={() => setWeekOffset(v => v + 1)}
            disabled={weekOffset >= 0}
            className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            다음 주 <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-gray-400 text-sm">불러오는 중...</p>
      ) : weekTasks.length === 0 && completedTasks.length === 0 && overdueTasks.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <TrendingUp size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">이번 주 활동이 없습니다.</p>
        </div>
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

          {/* 2컬럼 레이아웃: 왼쪽(태스크 목록) / 오른쪽(프로젝트별 현황) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* 왼쪽: 태스크 섹션들 */}
            <div className="lg:col-span-2 space-y-6">
              {overdueTasks.length > 0 && (
                <section>
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-red-600 mb-3">
                    <AlertCircle size={14} /> 기한 초과 ({overdueTasks.length})
                  </h2>
                  <div className="bg-white border border-red-100 rounded-xl overflow-hidden divide-y divide-gray-50">
                    {overdueTasks.map(t => <TaskRow key={t.id} task={t} />)}
                  </div>
                </section>
              )}

              {completedTasks.length > 0 && (
                <section>
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-green-600 mb-3">
                    <CheckCircle2 size={14} /> 이번 주 완료 ({completedTasks.length})
                  </h2>
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-50">
                    {completedTasks.map(t => <TaskRow key={t.id} task={t} />)}
                  </div>
                </section>
              )}

              {weekTasks.length > 0 && (
                <section>
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-blue-600 mb-3">
                    <Plus size={14} /> 이번 주 생성 ({weekTasks.length})
                  </h2>
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-50">
                    {weekTasks.map(t => <TaskRow key={t.id} task={t} />)}
                  </div>
                </section>
              )}

              {weeklyPosts.length > 0 && (
                <section>
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-purple-600 mb-3">
                    <MessageSquare size={14} /> 이번 주 이슈/기록 ({weeklyPosts.length})
                  </h2>
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-50">
                    {weeklyPosts.map(post => {
                      const proj = projMap[post.project_id]
                      const isNote = post.type === 'note'
                      const isOpen = post.status === 'open'
                      const pm = PRIORITY_META[post.priority]
                      return (
                        <Link
                          key={post.id}
                          href={`/projects/${post.project_id}/issues`}
                          className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors"
                        >
                          {isNote
                            ? <FileText size={14} className="text-purple-400 shrink-0" />
                            : <MessageSquare size={14} className={isOpen ? 'text-blue-500 shrink-0' : 'text-gray-400 shrink-0'} />
                          }
                          <span className="flex-1 text-sm text-gray-700 truncate">{post.title}</span>
                          {isNote ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 font-medium shrink-0">기록</span>
                          ) : (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${isOpen ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
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

            {/* 오른쪽: 프로젝트별 현황 */}
            {activeProjects.length > 0 && (
              <div className="lg:col-span-1">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                  <FolderKanban size={14} /> 프로젝트별 현황
                </h2>
                <div className="space-y-2 lg:sticky lg:top-8">
                  {activeProjects.map(p => {
                    const ps = byProject[p.id]
                    return (
                      <button
                        key={p.id}
                        onClick={() => router.push(`/projects/${p.id}`)}
                        className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                          <span className="text-sm font-semibold truncate">{p.name}</span>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
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
                          {ps.posts.length > 0 && (
                            <span className="flex items-center gap-1 text-purple-600">
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
