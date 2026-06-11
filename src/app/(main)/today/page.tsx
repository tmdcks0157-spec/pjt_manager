'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Task, Project, ProjectColumn } from '@/types'
import {
  Sun, Square, CalendarDays, Clock, Siren,
  Users, ChevronRight, CheckCircle2, CheckSquare,
  Plus, MessageSquare, FileText, Send, ListTodo,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const PRIORITY_META: Record<string, { label: string; className: string }> = {
  low:    { label: '낮음', className: 'bg-gray-100 text-gray-500' },
  normal: { label: '보통', className: 'bg-blue-100 text-blue-600' },
  high:   { label: '높음', className: 'bg-orange-100 text-orange-600' },
  urgent: { label: '긴급', className: 'bg-red-100 text-red-600' },
}

interface Post {
  id: string
  project_id: string
  type: 'issue' | 'note'
  title: string
  status: 'open' | 'closed'
  priority: string
  created_at: string
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

type AddType = 'task' | 'meeting' | 'issue'

export default function TodayPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  // ── 빠른 추가 상태 ──
  const [addType, setAddType] = useState<AddType>('task')
  const [addProjectId, setAddProjectId] = useState('')
  const [addTitle, setAddTitle] = useState('')
  const [addPostType, setAddPostType] = useState<'issue' | 'note'>('issue')
  const [addPriority, setAddPriority] = useState<'low'|'normal'|'high'|'urgent'>('normal')
  const [addDueDate, setAddDueDate] = useState(() => new Date().toISOString().split('T')[0])
  const [addTags, setAddTags] = useState<string[]>([])
  const [addTagInput, setAddTagInput] = useState('')
  const [addBody, setAddBody] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)

  function resetForm() {
    setAddTitle(''); setAddBody(''); setAddTags([]); setAddTagInput('')
    setAddPriority('normal')
    setAddDueDate(new Date().toISOString().split('T')[0])
  }

  function handleAddTag(raw: string) {
    const t = raw.trim().toLowerCase()
    if (t && !addTags.includes(t)) setAddTags(p => [...p, t])
    setAddTagInput('')
  }

  // ── queries ──
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').is('deleted_at', null).eq('archived', false).order('created_at')
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
        .from('tasks').select('*, checklist_items(*)')
        .is('deleted_at', null).eq('archived', false)
      if (error) throw error
      return data
    },
  })

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

  // 오늘 등록된 태스크 (created_at 기준, 완료 포함)
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
    if (projects.length > 0 && !addProjectId) setAddProjectId(projects[0].id)
  }, [projects, addProjectId])

  // 타입 변경 시 input 포커스
  useEffect(() => { titleInputRef.current?.focus() }, [addType])

  // ── mutations ──
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

  const createTaskMutation = useMutation({
    mutationFn: async () => {
      if (!addTitle.trim() || !addProjectId) return
      const { data: { user } } = await supabase.auth.getUser()
      const colId = firstColByProject[addProjectId]
      if (!colId) throw new Error('컬럼 없음')
      const { error } = await supabase.from('tasks').insert({
        title: addTitle.trim(),
        project_id: addProjectId,
        user_id: user!.id,
        status: colId,
        task_type: addType === 'meeting' ? 'meeting' : 'task',
        due_date: addDueDate ? new Date(addDueDate).toISOString() : null,
        priority: addPriority,
        tags: addTags,
        archived: false,
        order: 0,
      })
      if (error) throw error
    },
    onSuccess: () => {
      resetForm()
      queryClient.invalidateQueries({ queryKey: ['today-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      titleInputRef.current?.focus()
    },
  })

  const createPostMutation = useMutation({
    mutationFn: async () => {
      if (!addTitle.trim() || !addProjectId) return
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('posts').insert({
        title: addTitle.trim(),
        body: addBody.trim() || null,
        project_id: addProjectId,
        user_id: user!.id,
        type: addPostType,
        status: 'open',
        priority: addPostType === 'note' ? 'normal' : addPriority,
      })
      if (error) throw error
    },
    onSuccess: () => {
      resetForm()
      queryClient.invalidateQueries({ queryKey: ['today-posts', todayStart] })
      titleInputRef.current?.focus()
    },
  })

  function handleSubmit() {
    if (!addTitle.trim() || !addProjectId) return
    if (addType === 'issue') createPostMutation.mutate()
    else createTaskMutation.mutate()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
  }

  const isSubmitting = createTaskMutation.isPending || createPostMutation.isPending
  const totalToday = todayTasks.length + todayMeetings.length
  const isEmpty = totalToday === 0 && overdueTasks.length === 0 && urgentTasks.length === 0 && todayPosts.length === 0 && todayCreatedTasks.length === 0

  // ── sub-components ──
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
          <span className="text-sm text-gray-800 truncate">{task.title}</span>
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
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
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
    <div className="p-8 max-w-7xl mx-auto">
      {/* 헤더 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
          <Sun size={14} /> {fmtToday()}
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{getGreeting()}</h1>
      </div>

      {/* ── 빠른 추가 폼 ── */}
      <div className="bg-white border-2 border-gray-200 rounded-2xl p-5 mb-6 space-y-4">

        {/* 상단: 타입 탭 + 프로젝트 선택 */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1.5">
            {([
              { key: 'task',    label: '태스크',   icon: <Plus size={12} /> },
              { key: 'meeting', label: '일정',      icon: <Users size={12} /> },
              { key: 'issue',   label: '이슈/기록', icon: <MessageSquare size={12} /> },
            ] as { key: AddType; label: string; icon: React.ReactNode }[]).map(t => (
              <button
                key={t.key}
                onClick={() => { setAddType(t.key); resetForm() }}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all',
                  addType === t.key ? 'bg-gray-900 text-white border-gray-900' : 'text-gray-500 border-gray-200 hover:border-gray-400'
                )}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          <select
            value={addProjectId}
            onChange={e => setAddProjectId(e.target.value)}
            className="ml-auto text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-300 bg-gray-50 text-gray-700"
          >
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* 태스크 / 일정 폼 */}
        {(addType === 'task' || addType === 'meeting') && (
          <>
            {/* 제목 */}
            <input
              ref={titleInputRef}
              value={addTitle}
              onChange={e => setAddTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={addType === 'task' ? '태스크 제목 (필수)' : '일정 제목 (필수)'}
              className="w-full text-sm font-semibold focus:outline-none border-b-2 border-gray-200 focus:border-gray-800 pb-1.5 transition-colors bg-transparent"
            />

            {/* 우선순위 + 마감일 */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 shrink-0">우선순위</span>
                {(['low','normal','high','urgent'] as const).map(p => (
                  <button key={p} onClick={() => setAddPriority(p)}
                    className={cn('px-2.5 py-1 rounded-full text-xs font-medium border-2 transition-all',
                      PRIORITY_META[p].className,
                      addPriority === p ? 'border-gray-500' : 'border-transparent'
                    )}>
                    {PRIORITY_META[p].label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs text-gray-400 shrink-0">마감일</span>
                <input
                  type="date"
                  value={addDueDate}
                  onChange={e => setAddDueDate(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-gray-300 bg-gray-50"
                />
              </div>
            </div>

            {/* 태그 */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400 shrink-0">태그</span>
              {addTags.map(tag => (
                <span key={tag} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                  {tag}
                  <button onClick={() => setAddTags(p => p.filter(t => t !== tag))} className="hover:text-red-500 transition-colors">×</button>
                </span>
              ))}
              <input
                value={addTagInput}
                onChange={e => setAddTagInput(e.target.value)}
                onKeyDown={e => {
                  if ((e.key === 'Enter' || e.key === ',') && addTagInput.trim()) {
                    e.preventDefault(); handleAddTag(addTagInput)
                  }
                }}
                placeholder="태그 입력 후 Enter"
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-gray-300 bg-gray-50 w-32"
              />
            </div>
          </>
        )}

        {/* 이슈/기록 폼 */}
        {addType === 'issue' && (
          <>
            {/* 이슈/기록 서브 타입 */}
            <div className="flex gap-2">
              <button onClick={() => setAddPostType('issue')}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all',
                  addPostType === 'issue' ? 'bg-gray-900 text-white border-gray-900' : 'text-gray-500 border-gray-200 hover:border-gray-400')}>
                <MessageSquare size={11} /> 이슈
              </button>
              <button onClick={() => setAddPostType('note')}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all',
                  addPostType === 'note' ? 'bg-indigo-600 text-white border-indigo-600' : 'text-gray-500 border-gray-200 hover:border-gray-400')}>
                <FileText size={11} /> 기록
              </button>
            </div>

            {/* 제목 */}
            <input
              ref={titleInputRef}
              value={addTitle}
              onChange={e => setAddTitle(e.target.value)}
              placeholder={addPostType === 'issue' ? '이슈 제목 (필수)' : '기록 제목 (필수)'}
              className="w-full text-sm font-semibold focus:outline-none border-b-2 border-gray-200 focus:border-gray-800 pb-1.5 transition-colors bg-transparent"
            />

            {/* 본문 */}
            <textarea
              value={addBody}
              onChange={e => setAddBody(e.target.value)}
              placeholder={addPostType === 'issue' ? '상세 내용 (선택)' : '내용 입력...'}
              rows={3}
              className="w-full text-sm text-gray-700 border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none"
            />

            {/* 우선순위 (이슈만) */}
            {addPostType === 'issue' && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-400">우선순위</span>
                {(['low','normal','high','urgent'] as const).map(p => (
                  <button key={p} onClick={() => setAddPriority(p)}
                    className={cn('px-2.5 py-1 rounded-full text-xs font-medium border-2 transition-all',
                      PRIORITY_META[p].className,
                      addPriority === p ? 'border-gray-500' : 'border-transparent'
                    )}>
                    {PRIORITY_META[p].label}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* 제출 */}
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-gray-400">{addTitle.trim() ? '' : '제목을 입력해주세요'}</p>
          <button
            onClick={handleSubmit}
            disabled={!addTitle.trim() || !addProjectId || isSubmitting}
            className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-40 transition-all"
          >
            <Send size={13} />
            {addType === 'task' ? '태스크 추가' : addType === 'meeting' ? '일정 추가' : addPostType === 'issue' ? '이슈 등록' : '기록 저장'}
          </button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{totalToday}</p>
          <p className="text-xs text-gray-400 mt-0.5">오늘 할 일</p>
        </div>
        <div className={cn('border rounded-xl p-4 text-center',
          overdueTasks.length > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200')}>
          <p className={`text-2xl font-bold ${overdueTasks.length > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {overdueTasks.length}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">기한 초과</p>
        </div>
        <div className={cn('border rounded-xl p-4 text-center',
          urgentTasks.length > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200')}>
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
        <div className="text-center py-16 text-gray-400">
          <CheckCircle2 size={48} className="mx-auto mb-4 text-green-400" />
          <p className="text-lg font-semibold text-gray-600">오늘 할 일이 없어요!</p>
          <p className="text-sm mt-1">여유로운 하루를 보내세요 😊</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

          {/* ── 왼쪽: 처리해야 할 것 ── */}
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
            {todayMeetings.length === 0 && todayTasks.length === 0 && overdueTasks.length === 0 && urgentTasks.length === 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-400">
                <CheckCircle2 size={32} className="mx-auto mb-2 text-green-400" />
                <p className="text-sm">처리할 항목이 없어요</p>
              </div>
            )}
          </div>

          {/* ── 오른쪽: 오늘 등록한 것 ── */}
          <div className="space-y-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">오늘 등록한 것</p>

            {/* 오늘 등록된 태스크 (프로젝트별) */}
            {todayCreatedTasks.length > 0 ? (
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                  <ListTodo size={14} className="text-green-500" />
                  <span className="text-sm font-semibold text-green-600">등록한 태스크</span>
                  <span className="ml-auto text-xs text-gray-400 font-medium">{todayCreatedTasks.length}개</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {Object.entries(todayCreatedByProject).map(([projectId, ptasks]) => {
                    const proj = projMap[projectId]
                    return (
                      <div key={projectId}>
                        <button
                          onClick={() => router.push(`/projects/${projectId}`)}
                          className="w-full flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: proj?.color ?? '#ccc' }} />
                          <span className="text-xs font-semibold text-gray-600">{proj?.name ?? '알 수 없음'}</span>
                          <span className="text-[10px] text-gray-400 ml-1">{ptasks.length}개</span>
                          <ChevronRight size={11} className="ml-auto text-gray-300" />
                        </button>
                        <div className="divide-y divide-gray-50">
                          {ptasks.map(task => {
                            const isDone = doneColIds.has(task.status)
                            const pm = PRIORITY_META[task.priority]
                            const checklist = task.checklist_items ?? []
                            const completed = checklist.filter(i => i.completed).length
                            return (
                              <div key={task.id} className="flex items-center gap-3 pl-8 pr-4 py-2.5 hover:bg-gray-50 transition-colors">
                                {isDone
                                  ? <CheckCircle2 size={14} className="text-green-400 shrink-0" />
                                  : <Square size={14} className="text-gray-200 shrink-0" />}
                                <button
                                  onClick={() => router.push(`/projects/${projectId}`)}
                                  className={cn('flex-1 text-left text-sm truncate',
                                    isDone ? 'line-through text-gray-400' : 'text-gray-800')}
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
                                  {isDone && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">완료</span>}
                                  {task.task_type === 'meeting' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">일정</span>}
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
            ) : null}

            {/* 오늘 등록된 이슈/기록 */}
            {todayPosts.length > 0 ? (
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                  <MessageSquare size={14} className="text-purple-500" />
                  <span className="text-sm font-semibold text-purple-600">이슈/기록</span>
                  <span className="ml-auto text-xs text-gray-400 font-medium">{todayPosts.length}개</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {todayPosts.map(post => {
                    const proj = projMap[post.project_id]
                    const isNote = post.type === 'note'
                    return (
                      <Link
                        key={post.id}
                        href={`/projects/${post.project_id}/issues`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group"
                      >
                        {isNote
                          ? <FileText size={14} className="text-purple-400 shrink-0" />
                          : <MessageSquare size={14} className="text-blue-400 shrink-0" />}
                        <span className="flex-1 text-sm text-gray-800 truncate">{post.title}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                            isNote ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
                          )}>
                            {isNote ? '기록' : '이슈'}
                          </span>
                          {proj && <span className="text-[10px] text-gray-400">{proj.name}</span>}
                          <ChevronRight size={13} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {todayCreatedTasks.length === 0 && todayPosts.length === 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-400">
                <Plus size={32} className="mx-auto mb-2 text-gray-200" />
                <p className="text-sm">위 빠른 추가로 등록해보세요</p>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}
