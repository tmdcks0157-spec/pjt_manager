'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Task, Post } from '@/types'
import { useProjects } from '@/hooks/useProjects'
import { useAllColumns } from '@/hooks/useAllColumns'
import { useAllTasks } from '@/hooks/useAllTasks'
import { useContacts } from '@/hooks/useCRM'
import { PRIORITY_META } from '@/lib/constants'
import {
  Sun, Square, CalendarDays, Clock, Siren,
  Users, ChevronRight, CheckCircle2, CheckSquare,
  Plus, MessageSquare, FileText, ListTodo, BookOpen, AlertCircle, Circle, RotateCcw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import CreateTaskModal from '@/components/CreateTaskModal'


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

  // ── 모달/폼 상태 ──
  const [showTaskModal, setShowTaskModal]     = useState(false)
  const [showDoneSection, setShowDoneSection] = useState(true)
  const [showNoDueSection, setShowNoDueSection] = useState(true)
  const [showIssueForm, setShowIssueForm] = useState(false)
  const [issueProjectId, setIssueProjectId] = useState('')
  const [issueTitle, setIssueTitle]         = useState('')
  const [issuePostType, setIssuePostType]   = useState<'issue' | 'note'>('issue')
  const [issuePriority, setIssuePriority]   = useState<'low'|'normal'|'high'|'urgent'>('normal')
  const [issueBody, setIssueBody]           = useState('')
  const issueTitleRef = useRef<HTMLInputElement>(null)

  function resetIssueForm() {
    setIssueTitle(''); setIssueBody(''); setIssuePriority('normal')
  }

  // ── queries ──
  const { data: projects = [] } = useProjects()
  const { data: allContacts = [] } = useContacts()
  const { data: columns = [] } = useAllColumns()
  const { data: tasks = [], isLoading } = useAllTasks()

  const todayStart = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString() }, [])
  const todayEnd   = useMemo(() => { const d = new Date(); d.setHours(23,59,59,999); return d.toISOString() }, [])

  const { data: todayPosts = [] } = useQuery<Post[]>({
    queryKey: ['today-posts', todayStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts').select('id, project_id, type, title, status, priority, created_at')
        .gte('created_at', todayStart).lte('created_at', todayEnd)
        .order('created_at', { ascending: false })
      if (error) {
        if (error.code === '42P01' || error.message?.includes('posts')) return []
        throw error
      }
      return data ?? []
    },
  })

  // ── computed ──
  const doneColIds = useMemo(() => new Set(columns.filter(c => c.name === '완료').map(c => c.id)), [columns])
  const doneColByProject = useMemo(() => {
    const map: Record<string, string> = {}
    for (const c of columns) { if (c.name === '완료') map[c.project_id] = c.id }
    return map
  }, [columns])
  const firstColByProject = useMemo(() => {
    const map: Record<string, string> = {}
    const sorted = [...columns].sort((a, b) => a.order - b.order)
    for (const c of sorted) { if (!map[c.project_id] && c.name !== '완료') map[c.project_id] = c.id }
    return map
  }, [columns])
  const projMap = useMemo(() => Object.fromEntries(projects.map(p => [p.id, p])), [projects])

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d }, [])

  const activeTasks   = useMemo(() => tasks.filter(t => !doneColIds.has(t.status)), [tasks, doneColIds])
  const todayMeetings = useMemo(() => activeTasks.filter(t => {
    if (t.task_type !== 'meeting' || !t.due_date) return false
    const d = new Date(t.due_date); d.setHours(0,0,0,0)
    return d.getTime() === today.getTime()
  }), [activeTasks, today])
  const todayTasks = useMemo(() => activeTasks.filter(t => {
    if (t.task_type === 'meeting' || !t.due_date) return false
    const d = new Date(t.due_date); d.setHours(0,0,0,0)
    return d.getTime() === today.getTime()
  }), [activeTasks, today])
  const overdueTasks = useMemo(() => activeTasks.filter(t => {
    if (!t.due_date || t.task_type === 'meeting') return false
    const d = new Date(t.due_date); d.setHours(0,0,0,0)
    return d < today
  }), [activeTasks, today])
  const urgentTasks = useMemo(() => activeTasks.filter(t => {
    if (t.priority !== 'urgent') return false
    if (!t.due_date) return true
    const d = new Date(t.due_date); d.setHours(0,0,0,0)
    return d > today
  }), [activeTasks, today])

  // 마감일 없는 미완료 태스크 (긴급/일정 제외 — 이미 위에서 표시됨)
  const noDueTasks = useMemo(() => activeTasks.filter(t =>
    !t.due_date && t.priority !== 'urgent' && t.task_type !== 'meeting'
  ), [activeTasks])

  // 이번 주 마감 예정 (오늘 제외, 내일~일요일)
  const weekEnd = useMemo(() => {
    const d = new Date(today)
    const day = d.getDay()
    const daysUntilSunday = day === 0 ? 0 : 7 - day
    d.setDate(d.getDate() + daysUntilSunday)
    d.setHours(23, 59, 59, 999)
    return d
  }, [today])
  const tomorrow = useMemo(() => { const d = new Date(today); d.setDate(d.getDate() + 1); return d }, [today])

  const weekDueTasks = useMemo(() => activeTasks.filter(t => {
    if (!t.due_date || t.task_type === 'meeting') return false
    const d = new Date(t.due_date); d.setHours(0, 0, 0, 0)
    return d >= tomorrow && d <= weekEnd
  }).sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime()), [activeTasks, tomorrow, weekEnd])

  // CRM 연결 태스크 (오늘/초과 마감, 연락처 있는 것)
  const contactsMap = useMemo(() => Object.fromEntries(allContacts.map(c => [c.id, c])), [allContacts])
  const crmDueTasks = useMemo(() => activeTasks.filter(t => {
    if (!t.contact_id || !t.due_date) return false
    const d = new Date(t.due_date); d.setHours(0, 0, 0, 0)
    return d <= today
  }), [activeTasks, today])
  // 연락처별로 그룹핑 (연락할 사람 목록)
  const crmContactIds = useMemo(() =>
    [...new Set(crmDueTasks.map(t => t.contact_id!))],
    [crmDueTasks]
  )

  // 오늘 완료 처리한 태스크 (완료 컬럼 + updated_at 오늘)
  const todayDoneTasks = useMemo(() =>
    tasks.filter(t => doneColIds.has(t.status) && t.updated_at >= todayStart && t.updated_at <= todayEnd),
    [tasks, doneColIds, todayStart, todayEnd]
  )

  const todayCreatedTasks = useMemo(() =>
    tasks.filter(t => t.created_at >= todayStart && t.created_at <= todayEnd),
    [tasks, todayStart, todayEnd]
  )
  const todayCreatedByProject = useMemo(() => {
    const map: Record<string, Task[]> = {}
    for (const t of todayCreatedTasks) {
      if (!map[t.project_id]) map[t.project_id] = []
      map[t.project_id].push(t)
    }
    return map
  }, [todayCreatedTasks])

  // 첫 프로젝트 기본 선택
  useEffect(() => {
    if (projects.length > 0 && !issueProjectId) setIssueProjectId(projects[0].id)
  }, [projects, issueProjectId])

  // 이슈 폼 열릴 때 포커스
  useEffect(() => {
    if (showIssueForm) setTimeout(() => issueTitleRef.current?.focus(), 50)
  }, [showIssueForm])

  // ── mutations ──
  const undoneMutation = useMutation({
    mutationFn: async (task: Task) => {
      const firstColId = firstColByProject[task.project_id]
      if (!firstColId) throw new Error('활성 컬럼 없음')
      const { error } = await supabase.from('tasks')
        .update({ status: firstColId, updated_at: new Date().toISOString() })
        .eq('id', task.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  const doneMutation = useMutation({
    mutationFn: async (task: Task) => {
      const doneColId = doneColByProject[task.project_id]
      if (!doneColId) throw new Error('완료 컬럼 없음')
      const { error } = await supabase.from('tasks')
        .update({ status: doneColId, updated_at: new Date().toISOString() })
        .eq('id', task.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  const closeIssueMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'open' | 'closed' }) => {
      const { error } = await supabase.from('posts').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['today-posts', todayStart] }),
  })

  const createPostMutation = useMutation({
    mutationFn: async () => {
      if (!issueTitle.trim() || !issueProjectId) return
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('posts').insert({
        title: issueTitle.trim(),
        body: issueBody.trim() || null,
        project_id: issueProjectId,
        user_id: user!.id,
        type: issuePostType,
        status: 'open',
        priority: issuePostType === 'note' ? 'normal' : issuePriority,
      })
      if (error) throw error
    },
    onSuccess: () => {
      resetIssueForm()
      setShowIssueForm(false)
      queryClient.invalidateQueries({ queryKey: ['today-posts', todayStart] })
    },
  })

  const totalToday = todayTasks.length + todayMeetings.length
  const isEmpty = totalToday === 0 && overdueTasks.length === 0 && urgentTasks.length === 0 && noDueTasks.length === 0 && todayPosts.length === 0 && todayCreatedTasks.length === 0 && todayDoneTasks.length === 0 && crmContactIds.length === 0 && weekDueTasks.length === 0

  // ── sub-components ──
  function TaskRow({ task }: { task: Task }) {
    const proj = projMap[task.project_id]
    const pm = PRIORITY_META[task.priority]
    const hasDoneCol = !!doneColByProject[task.project_id]
    const checklist = task.checklist_items ?? []
    const completed = checklist.filter(i => i.completed).length

    return (
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group">
        <button
          onClick={() => hasDoneCol && doneMutation.mutate(task)}
          disabled={!hasDoneCol}
          className={cn('shrink-0 transition-colors',
            hasDoneCol ? 'text-gray-300 hover:text-green-500 cursor-pointer' : 'text-gray-200 cursor-default')}
          title={hasDoneCol ? '완료 처리' : undefined}
        >
          <Square size={16} />
        </button>
        <button
          onClick={() => router.push(`/projects/${task.project_id}`)}
          className="flex-1 text-left flex items-center gap-2 min-w-0"
        >
          {proj && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: proj.color }} />}
          <span className="text-sm text-gray-800 dark:text-gray-200 truncate">{task.title}</span>
        </button>
        <div className="flex items-center gap-1.5 shrink-0">
          {checklist.length > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
              <CheckSquare size={10} /> {completed}/{checklist.length}
            </span>
          )}
          {task.priority !== 'normal' && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${pm.className}`}>{pm.label}</span>
          )}
          {proj && <span className="text-[10px] text-gray-400 hidden sm:block">{proj.name}</span>}
          <ChevronRight size={13} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
        </div>
      </div>
    )
  }

  function Section({ title, icon, count, tasks, accent }: {
    title: string; icon: React.ReactNode; count: number; tasks: Task[]; accent: string
  }) {
    if (tasks.length === 0) return null
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          {icon}
          <span className={`text-sm font-semibold ${accent}`}>{title}</span>
          <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 font-medium">{count}개</span>
        </div>
        <div className="divide-y divide-gray-50 dark:divide-gray-700">
          {tasks.map(t => <TaskRow key={t.id} task={t} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 mb-2">
          <Sun size={14} /> {fmtToday()}
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{getGreeting()}</h1>
      </div>

      {/* ── 빠른 추가 ── */}
      <div className="mb-6 space-y-3">
        {/* 액션 버튼 행 */}
        <div className="flex gap-3">
          <button
            onClick={() => setShowTaskModal(true)}
            className="flex-1 flex items-center gap-2.5 px-4 py-3.5 bg-white dark:bg-gray-800 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-2xl hover:border-gray-900 dark:hover:border-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all text-sm text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 group font-medium"
          >
            <div className="w-6 h-6 rounded-lg bg-gray-100 group-hover:bg-gray-900 flex items-center justify-center transition-all">
              <Plus size={13} className="text-gray-500 group-hover:text-white transition-colors" />
            </div>
            태스크 / 일정 추가
          </button>

          <button
            onClick={() => { setShowIssueForm(p => !p); if (showIssueForm) resetIssueForm() }}
            className={cn(
              'flex-1 flex items-center gap-2.5 px-4 py-3.5 border-2 rounded-2xl transition-all text-sm font-medium',
              showIssueForm
                ? 'bg-gray-900 dark:bg-gray-700 border-gray-900 dark:border-gray-600 text-white'
                : 'bg-white dark:bg-gray-800 border-dashed border-gray-200 dark:border-gray-600 hover:border-gray-900 dark:hover:border-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            )}
          >
            <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center transition-all',
              showIssueForm ? 'bg-white/20' : 'bg-gray-100 group-hover:bg-gray-900')}>
              <MessageSquare size={13} className={showIssueForm ? 'text-white' : 'text-gray-500'} />
            </div>
            이슈 / 기록 추가
          </button>
        </div>

        {/* 이슈/기록 인라인 폼 */}
        {showIssueForm && (
          <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-600 rounded-2xl p-5 space-y-4">
            {/* 프로젝트 + 타입 */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex gap-2">
                <button onClick={() => setIssuePostType('issue')}
                  className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all',
                    issuePostType === 'issue' ? 'bg-gray-900 text-white border-gray-900' : 'text-gray-500 border-gray-200 hover:border-gray-400')}>
                  <AlertCircle size={11} /> 이슈
                </button>
                <button onClick={() => setIssuePostType('note')}
                  className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all',
                    issuePostType === 'note' ? 'bg-indigo-600 text-white border-indigo-600' : 'text-gray-500 border-gray-200 hover:border-gray-400')}>
                  <BookOpen size={11} /> 기록
                </button>
              </div>
              <select
                value={issueProjectId}
                onChange={e => setIssueProjectId(e.target.value)}
                className="ml-auto text-xs border border-gray-200 dark:border-gray-600 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {/* 제목 */}
            <input
              ref={issueTitleRef}
              value={issueTitle}
              onChange={e => setIssueTitle(e.target.value)}
              placeholder={issuePostType === 'issue' ? '이슈 제목 (필수)' : '기록 제목 (필수)'}
              className="w-full text-sm font-semibold text-gray-900 dark:text-gray-100 focus:outline-none border-b-2 border-gray-200 dark:border-gray-600 focus:border-gray-800 dark:focus:border-gray-400 pb-1.5 transition-colors bg-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />

            {/* 본문 */}
            <textarea
              value={issueBody}
              onChange={e => setIssueBody(e.target.value)}
              placeholder={issuePostType === 'issue' ? '상세 내용 (선택)' : '내용 입력...'}
              rows={3}
              className="w-full text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-600 resize-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />

            {/* 우선순위 (이슈만) */}
            {issuePostType === 'issue' && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-400">우선순위</span>
                {(['low','normal','high','urgent'] as const).map(p => (
                  <button key={p} onClick={() => setIssuePriority(p)}
                    className={cn('px-2.5 py-1 rounded-full text-xs font-medium border-2 transition-all',
                      PRIORITY_META[p].className,
                      issuePriority === p ? 'border-gray-500' : 'border-transparent')}>
                    {PRIORITY_META[p].label}
                  </button>
                ))}
              </div>
            )}

            {/* 액션 */}
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-gray-400">{issueTitle.trim() ? '' : '제목을 입력해주세요'}</p>
              <div className="flex gap-2">
                <button onClick={() => { setShowIssueForm(false); resetIssueForm() }}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                  취소
                </button>
                <button
                  onClick={() => createPostMutation.mutate()}
                  disabled={!issueTitle.trim() || createPostMutation.isPending}
                  className="px-4 py-1.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-40 transition-colors"
                >
                  {createPostMutation.isPending ? '저장 중...' : issuePostType === 'issue' ? '이슈 등록' : '기록 저장'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalToday}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">오늘 할 일</p>
        </div>
        <div className={cn('border rounded-xl p-4 text-center',
          overdueTasks.length > 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700')}>
          <p className={`text-2xl font-bold ${overdueTasks.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'}`}>
            {overdueTasks.length}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">기한 초과</p>
        </div>
        <div className={cn('border rounded-xl p-4 text-center',
          urgentTasks.length > 0 ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700')}>
          <p className={`text-2xl font-bold ${urgentTasks.length > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-gray-100'}`}>
            {urgentTasks.length}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">긴급</p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{todayMeetings.length}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">오늘 일정</p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-gray-400 text-sm">불러오는 중...</p>
      ) : isEmpty ? (
        <div className="text-center py-16 text-gray-400">
          <CheckCircle2 size={48} className="mx-auto mb-4 text-green-400" />
          <p className="text-lg font-semibold text-gray-600">오늘 할 일이 없어요!</p>
          <p className="text-sm mt-1">여유로운 하루를 보내세요 😊</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

          {/* ── 왼쪽: 처리할 것 ── */}
          <div className="space-y-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">처리할 것</p>
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

            {/* 미완료 (마감일 없는) 태스크 */}
            {noDueTasks.length > 0 && (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setShowNoDueSection(p => !p)}
                  className="w-full flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <ListTodo size={14} className="text-gray-400" />
                  <span className="text-sm font-semibold text-gray-500">미완료 태스크</span>
                  <span className="ml-auto flex items-center gap-2">
                    <span className="text-xs text-gray-400 font-medium">{noDueTasks.length}개</span>
                    <ChevronRight size={13} className={cn('text-gray-300 transition-transform', showNoDueSection ? 'rotate-90' : '')} />
                  </span>
                </button>
                {showNoDueSection && (
                  <div className="divide-y divide-gray-50 dark:divide-gray-700">
                    {noDueTasks.map(t => <TaskRow key={t.id} task={t} />)}
                  </div>
                )}
              </div>
            )}

            {/* 연락할 것 (CRM 연결 태스크) */}
            {crmContactIds.length > 0 && (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <Users size={14} className="text-teal-500" />
                  <span className="text-sm font-semibold text-teal-600 dark:text-teal-400">연락할 것</span>
                  <span className="ml-auto text-xs text-gray-400 font-medium">{crmContactIds.length}건</span>
                </div>
                <div className="divide-y divide-gray-50 dark:divide-gray-700">
                  {crmContactIds.map(contactId => {
                    const contact = contactsMap[contactId]
                    if (!contact) return null
                    const linkedTasks = crmDueTasks.filter(t => t.contact_id === contactId)
                    return (
                      <Link key={contactId} href={`/crm/contacts/${contactId}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 dark:text-gray-200 font-medium truncate">
                            {contact.name}
                            {contact.company && <span className="font-normal text-gray-400 ml-1">· {contact.company.name}</span>}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                            {linkedTasks[0].title}{linkedTasks.length > 1 ? ` 외 ${linkedTasks.length - 1}건` : ''}
                          </p>
                        </div>
                        <span className="text-[10px] font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 px-1.5 py-0.5 rounded-full shrink-0">
                          {linkedTasks.length}개
                        </span>
                        <ChevronRight size={13} className="text-gray-300 group-hover:text-gray-500 transition-colors shrink-0" />
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}

            {todayMeetings.length === 0 && todayTasks.length === 0 && overdueTasks.length === 0 && urgentTasks.length === 0 && noDueTasks.length === 0 && todayDoneTasks.length === 0 && crmContactIds.length === 0 && (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-8 text-center text-gray-400 dark:text-gray-500">
                <CheckCircle2 size={32} className="mx-auto mb-2 text-green-400" />
                <p className="text-sm">처리할 항목이 없어요</p>
            </div>
            )}

            {/* 오늘 처리 완료 */}
            {todayDoneTasks.length > 0 && (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setShowDoneSection(p => !p)}
                  className="w-full flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <CheckCircle2 size={14} className="text-green-500" />
                  <span className="text-sm font-semibold text-green-600">처리 완료</span>
                  <span className="ml-auto flex items-center gap-2">
                    <span className="text-xs text-gray-400 font-medium">{todayDoneTasks.length}개</span>
                    <ChevronRight size={13} className={cn('text-gray-300 transition-transform', showDoneSection ? 'rotate-90' : '')} />
                  </span>
                </button>
                {showDoneSection && (
                  <div className="divide-y divide-gray-50 dark:divide-gray-700">
                    {todayDoneTasks.map(task => {
                      const proj = projMap[task.project_id]
                      const checklist = task.checklist_items ?? []
                      const completed = checklist.filter(i => i.completed).length
                      return (
                        <div key={task.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group">
                          <button
                            onClick={() => undoneMutation.mutate(task)}
                            disabled={undoneMutation.isPending}
                            title="완료 취소"
                            className="shrink-0 text-green-400 hover:text-gray-300 transition-colors cursor-pointer"
                          >
                            <CheckCircle2 size={16} />
                          </button>
                          <button
                            onClick={() => router.push(`/projects/${task.project_id}`)}
                            className="flex-1 text-left flex items-center gap-2 min-w-0"
                          >
                            {proj && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: proj.color }} />}
                            <span className="text-sm text-gray-400 line-through truncate">{task.title}</span>
                          </button>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {checklist.length > 0 && (
                              <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                                <CheckSquare size={10} /> {completed}/{checklist.length}
                              </span>
                            )}
                            {proj && <span className="text-[10px] text-gray-400 hidden sm:block">{proj.name}</span>}
                            <ChevronRight size={13} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── 오른쪽: 이번 주 마감 예정 + 오늘 등록한 것 ── */}
          <div className="space-y-4">

            {/* 이번 주 마감 예정 */}
            {weekDueTasks.length > 0 && (
              <>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">이번 주 마감 예정</p>
                <div className="bg-white dark:bg-gray-800 border border-blue-100 dark:border-blue-900/40 rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-blue-50 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-900/10">
                    <CalendarDays size={14} className="text-blue-500" />
                    <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">이번 주 마감</span>
                    <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 font-medium">{weekDueTasks.length}개</span>
                  </div>
                  <div className="divide-y divide-gray-50 dark:divide-gray-700">
                    {weekDueTasks.map(task => {
                      const proj = projMap[task.project_id]
                      const pm = PRIORITY_META[task.priority]
                      const dueDate = new Date(task.due_date!)
                      dueDate.setHours(0, 0, 0, 0)
                      const diffDays = Math.round((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                      const dayLabel = diffDays === 1 ? '내일' : dueDate.toLocaleDateString('ko-KR', { weekday: 'short', month: 'numeric', day: 'numeric' })
                      return (
                        <button
                          key={task.id}
                          onClick={() => router.push(`/projects/${task.project_id}`)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group text-left"
                        >
                          {proj && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: proj.color }} />}
                          <span className="flex-1 text-sm text-gray-800 dark:text-gray-200 truncate">{task.title}</span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {task.priority !== 'normal' && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${pm.className}`}>{pm.label}</span>
                            )}
                            <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded-full">{dayLabel}</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </>
            )}

            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">오늘 등록한 것</p>

            {/* 오늘 등록된 태스크 (프로젝트별) */}
            {todayCreatedTasks.length > 0 && (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <ListTodo size={14} className="text-green-500" />
                  <span className="text-sm font-semibold text-green-600">등록한 태스크</span>
                  <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 font-medium">{todayCreatedTasks.length}개</span>
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {Object.entries(todayCreatedByProject).map(([projectId, ptasks]) => {
                    const proj = projMap[projectId]
                    return (
                      <div key={projectId}>
                        <button
                          onClick={() => router.push(`/projects/${projectId}`)}
                          className="w-full flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: proj?.color ?? '#ccc' }} />
                          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">{proj?.name ?? '알 수 없음'}</span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-1">{ptasks.length}개</span>
                          <ChevronRight size={11} className="ml-auto text-gray-300" />
                        </button>
                        <div className="divide-y divide-gray-50 dark:divide-gray-700">
                          {ptasks.map(task => {
                            const isDone = doneColIds.has(task.status)
                            const pm = PRIORITY_META[task.priority]
                            const checklist = task.checklist_items ?? []
                            const completed = checklist.filter(i => i.completed).length
                            return (
                              <div key={task.id} className="flex items-center gap-3 pl-8 pr-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group/task">
                                <button
                                  onClick={() => isDone ? undoneMutation.mutate(task) : doneMutation.mutate(task)}
                                  disabled={isDone ? !firstColByProject[task.project_id] : !doneColByProject[task.project_id]}
                                  title={isDone ? '완료 취소' : '완료 처리'}
                                  className={cn('shrink-0 transition-colors cursor-pointer',
                                    isDone
                                      ? 'text-green-400 hover:text-gray-300'
                                      : 'text-gray-300 hover:text-green-500')}
                                >
                                  {isDone
                                    ? <CheckCircle2 size={14} />
                                    : <Square size={14} />}
                                </button>
                                <button
                                  onClick={() => router.push(`/projects/${projectId}`)}
                                  className={cn('flex-1 text-left text-sm truncate',
                                    isDone ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-200')}
                                >
                                  {task.title}
                                </button>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {checklist.length > 0 && (
                                    <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                                      <CheckSquare size={10} /> {completed}/{checklist.length}
                                    </span>
                                  )}
                                  {task.priority !== 'normal' && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${pm.className}`}>{pm.label}</span>
                                  )}
                                  {isDone && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 font-medium">완료</span>}
                                  {task.task_type === 'meeting' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-medium">일정</span>}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 오늘 등록된 이슈/기록 */}
            {todayPosts.length > 0 && (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <MessageSquare size={14} className="text-purple-500" />
                  <span className="text-sm font-semibold text-purple-600">이슈/기록</span>
                  <span className="ml-auto text-xs text-gray-400 dark:text-gray-500 font-medium">{todayPosts.length}개</span>
                </div>
                <div className="divide-y divide-gray-50 dark:divide-gray-700">
                  {todayPosts.map(post => {
                    const proj = projMap[post.project_id]
                    const isNote = post.type === 'note'
                    const isClosed = post.status === 'closed'
                    return (
                      <div key={post.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group">
                        {/* 이슈: 상태 토글 버튼 / 기록: 아이콘만 */}
                        {isNote ? (
                          <FileText size={14} className="text-purple-400 shrink-0" />
                        ) : (
                          <button
                            onClick={() => closeIssueMutation.mutate({
                              id: post.id,
                              status: isClosed ? 'open' : 'closed',
                            })}
                            title={isClosed ? '이슈 다시 열기' : '이슈 닫기'}
                            className="shrink-0 transition-colors"
                          >
                            {isClosed
                              ? <CheckCircle2 size={14} className="text-green-400 hover:text-gray-400 transition-colors" />
                              : <Circle size={14} className="text-gray-300 hover:text-green-500 transition-colors" />}
                          </button>
                        )}

                        {/* 제목 — 클릭 시 이슈 페이지로 */}
                        <Link
                          href={`/projects/${post.project_id}/issues`}
                          className={cn('flex-1 text-sm truncate hover:underline',
                            isClosed ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-200')}
                        >
                          {post.title}
                        </Link>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {isClosed && (
                            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 font-medium">
                              닫힘
                            </span>
                          )}
                          <span className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                            isNote ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                          )}>
                            {isNote ? '기록' : '이슈'}
                          </span>
                          {proj && <span className="text-[10px] text-gray-400">{proj.name}</span>}
                          {isClosed && (
                            <button
                              onClick={() => closeIssueMutation.mutate({ id: post.id, status: 'open' })}
                              title="다시 열기"
                              className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-blue-500 transition-all"
                            >
                              <RotateCcw size={11} />
                            </button>
                          )}
                          <ChevronRight size={13} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {todayCreatedTasks.length === 0 && todayPosts.length === 0 && (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-8 text-center text-gray-400 dark:text-gray-500">
                <Plus size={32} className="mx-auto mb-2 text-gray-200" />
                <p className="text-sm">위 버튼으로 등록해보세요</p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* CreateTaskModal */}
      {showTaskModal && (
        <CreateTaskModal
          projects={projects}
          columns={columns}
          defaultProjectId={issueProjectId || projects[0]?.id}
          onClose={() => setShowTaskModal(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['tasks'] })}
        />
      )}
    </div>
  )
}
