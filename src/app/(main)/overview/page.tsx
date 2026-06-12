'use client'

import { useEffect, useRef, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Task, TaskPriority, Post } from '@/types'
import { useProjects } from '@/hooks/useProjects'
import { useAllColumns } from '@/hooks/useAllColumns'
import { useAllTasks } from '@/hooks/useAllTasks'
import { PRIORITY_META } from '@/lib/constants'
import {
  CalendarDays, ChevronDown, ChevronRight,
  Layers, Siren, CheckSquare, Clock,
  MessageSquare, FileText, AlertCircle,
  X, ExternalLink, Circle, CheckCircle2, BookOpen, Square,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type FilterType      = 'all' | 'overdue' | 'today' | 'urgent' | 'high'
type ViewType        = 'tasks' | 'issues'
type IssueFilterType = 'all' | 'open' | 'closed' | 'note'
type SelectedItem    =
  | { kind: 'task'; item: Task }
  | { kind: 'post'; item: Post; projectId: string }
  | null

function AutoTextarea({
  value, onChange, placeholder, className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [value])
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={3}
      style={{ overflow: 'hidden' }}
      className={cn(
        'w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none transition-all',
        className
      )}
    />
  )
}

function fmtTimestamp(d: string) {
  const date = new Date(d)
  const yy  = String(date.getFullYear()).slice(2)
  const mm  = String(date.getMonth() + 1).padStart(2, '0')
  const dd  = String(date.getDate()).padStart(2, '0')
  const hh  = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${yy}-${mm}-${dd} ${hh}:${min}`
}

export default function OverviewPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [view, setView]               = useState<ViewType>('tasks')
  const [filter, setFilter]           = useState<FilterType>('all')
  const [issueFilter, setIssueFilter] = useState<IssueFilterType>('open')
  const [collapsed, setCollapsed]     = useState<Set<string>>(new Set())
  const [selected, setSelected]       = useState<SelectedItem>(null)

  // ── 패널 편집 상태 ──
  const [panelTitle, setPanelTitle]       = useState('')
  const [panelBody, setPanelBody]         = useState('')
  const [panelNotes, setPanelNotes]       = useState('')
  const [panelPriority, setPanelPriority] = useState<TaskPriority>('normal')
  const [panelDueDate, setPanelDueDate]   = useState('')
  const [panelDirty, setPanelDirty]       = useState(false)

  // 선택 변경 시 패널 필드 초기화
  useEffect(() => {
    if (!selected) return
    setPanelDirty(false)
    if (selected.kind === 'task') {
      const t = selected.item
      setPanelTitle(t.title)
      setPanelBody(t.description ?? '')
      setPanelNotes(t.notes ?? '')
      setPanelPriority(t.priority)
      setPanelDueDate(t.due_date ? t.due_date.split('T')[0] : '')
    } else {
      const p = selected.item
      setPanelTitle(p.title)
      setPanelBody(p.body ?? '')
      setPanelNotes('')
      setPanelPriority(p.priority as TaskPriority)
      setPanelDueDate('')
    }
  }, [selected])

  // ESC로 패널 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const { data: projects = [] }                         = useProjects()
  const { data: columns = [] }                          = useAllColumns()
  const { data: allTasks = [], isLoading: tasksLoading } = useAllTasks()

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
  const doneColByProject = useMemo(() => {
    const map: Record<string, string> = {}
    for (const c of columns) { if (c.name === '완료') map[c.project_id] = c.id }
    return map
  }, [columns])
  const colMap  = useMemo(() => Object.fromEntries(columns.map(c => [c.id, c])), [columns])
  const projMap = useMemo(() => Object.fromEntries(projects.map(p => [p.id, p])), [projects])

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])

  const activeTasks = useMemo(
    () => allTasks.filter(t => !doneColIds.has(t.status)),
    [allTasks, doneColIds]
  )

  const filteredTasks = useMemo(() => {
    switch (filter) {
      case 'overdue': return activeTasks.filter(t => {
        if (!t.due_date || t.task_type === 'meeting') return false
        const d = new Date(t.due_date); d.setHours(0, 0, 0, 0); return d < today
      })
      case 'today': return activeTasks.filter(t => {
        if (!t.due_date || t.task_type === 'meeting') return false
        const d = new Date(t.due_date); d.setHours(0, 0, 0, 0)
        return d.getTime() === today.getTime()
      })
      case 'urgent': return activeTasks.filter(t => t.priority === 'urgent')
      case 'high':   return activeTasks.filter(t => t.priority === 'high' || t.priority === 'urgent')
      default:       return activeTasks
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
    for (const t of filteredTasks) { if (map[t.project_id]) map[t.project_id].push(t) }
    return map
  }, [projects, filteredTasks])

  const postsByProject = useMemo(() => {
    const map: Record<string, Post[]> = {}
    for (const p of projects) map[p.id] = []
    for (const p of filteredPosts) { if (map[p.project_id]) map[p.project_id].push(p) }
    return map
  }, [projects, filteredPosts])

  const activeTaskProjects  = projects.filter(p => tasksByProject[p.id]?.length > 0)
  const activeIssueProjects = projects.filter(p => postsByProject[p.id]?.length > 0)

  const stats = useMemo(() => ({
    total:   activeTasks.length,
    overdue: activeTasks.filter(t => {
      if (!t.due_date || t.task_type === 'meeting') return false
      const d = new Date(t.due_date); d.setHours(0, 0, 0, 0); return d < today
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

  function toggleCollapse(key: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  // ── mutations ──
  const updateTaskMutation = useMutation({
    mutationFn: async () => {
      if (selected?.kind !== 'task') return
      const { error } = await supabase.from('tasks').update({
        title:       panelTitle.trim(),
        description: panelBody.trim() || null,
        notes:       panelNotes.trim() || null,
        priority:    panelPriority,
        due_date:    panelDueDate || null,
        updated_at:  new Date().toISOString(),
      }).eq('id', selected.item.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setPanelDirty(false)
    },
  })

  const completeTaskMutation = useMutation({
    mutationFn: async () => {
      if (selected?.kind !== 'task') return
      const doneColId = doneColByProject[selected.item.project_id]
      if (!doneColId) throw new Error('완료 컬럼 없음')
      const { error } = await supabase.from('tasks')
        .update({ status: doneColId, updated_at: new Date().toISOString() })
        .eq('id', selected.item.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setSelected(null)
    },
  })

  const updatePostMutation = useMutation({
    mutationFn: async () => {
      if (selected?.kind !== 'post') return
      const { error } = await supabase.from('posts').update({
        title:      panelTitle.trim(),
        body:       panelBody.trim() || null,
        priority:   selected.item.type === 'note' ? 'normal' : panelPriority,
        updated_at: new Date().toISOString(),
      }).eq('id', selected.item.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overview-posts'] })
      setPanelDirty(false)
    },
  })

  const togglePostStatusMutation = useMutation({
    mutationFn: async ({ postId, status }: { postId: string; status: 'open' | 'closed' }) => {
      const { error } = await supabase.from('posts').update({ status }).eq('id', postId)
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['overview-posts'] })
      if (selected?.kind === 'post') {
        setSelected({ ...selected, item: { ...selected.item, status: vars.status } })
      }
    },
  })

  const TASK_FILTERS: { key: FilterType; label: string; count: number; className: string }[] = [
    { key: 'all',     label: '전체',      count: stats.total,               className: 'text-gray-700' },
    { key: 'overdue', label: '기한 초과', count: stats.overdue,             className: 'text-red-600' },
    { key: 'today',   label: '오늘 마감', count: stats.today,               className: 'text-orange-600' },
    { key: 'urgent',  label: '긴급',      count: stats.urgent,              className: 'text-red-600' },
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

  // ── 우측 디테일 패널 ──
  function DetailPanel() {
    if (!selected) return null

    if (selected.kind === 'task') {
      const task = selected.item
      const proj = projMap[task.project_id]
      const col  = colMap[task.status]
      const checklist = task.checklist_items ?? []
      const completedCount = checklist.filter(i => i.completed).length
      const isOverdue = task.due_date && task.task_type !== 'meeting' && (() => {
        const d = new Date(task.due_date); d.setHours(0, 0, 0, 0); return d < today
      })()

      return (
        <div className="sticky top-8 bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col max-h-[calc(100vh-4rem)]">
          {/* 헤더 */}
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 bg-gray-50 shrink-0">
            {proj && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: proj.color }} />}
            <span className="text-xs font-semibold text-gray-500 flex-1 truncate">{proj?.name}</span>
            <Link
              href={`/projects/${task.project_id}`}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ExternalLink size={11} /> 칸반
            </Link>
            <button onClick={() => setSelected(null)} className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
              <X size={14} />
            </button>
          </div>

          {/* 스크롤 본문 */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
            {/* 제목 */}
            <div>
              <label className="block text-[11px] font-medium text-gray-400 mb-1">제목</label>
              <input
                value={panelTitle}
                onChange={e => { setPanelTitle(e.target.value); setPanelDirty(true) }}
                className="w-full text-sm font-semibold border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all"
              />
            </div>

            {/* 컬럼 상태 */}
            {col && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-gray-400">상태</span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium text-gray-600"
                  style={{ backgroundColor: col.color + '40' }}
                >
                  {col.name}
                </span>
                {isOverdue && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-500 font-medium flex items-center gap-0.5">
                    <Clock size={10} /> 기한 초과
                  </span>
                )}
              </div>
            )}

            {/* 우선순위 */}
            <div>
              <label className="block text-[11px] font-medium text-gray-400 mb-2">우선순위</label>
              <div className="flex gap-2 flex-wrap">
                {(Object.keys(PRIORITY_META) as TaskPriority[]).map(p => (
                  <button key={p}
                    onClick={() => { setPanelPriority(p); setPanelDirty(true) }}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all',
                      PRIORITY_META[p].className,
                      panelPriority === p ? 'border-gray-500 ring-2 ring-offset-1 ring-gray-200' : 'border-transparent'
                    )}
                  >
                    {PRIORITY_META[p].label}
                  </button>
                ))}
              </div>
            </div>

            {/* 마감일 */}
            <div>
              <label className="block text-[11px] font-medium text-gray-400 mb-1">마감일</label>
              <input
                type="date"
                value={panelDueDate}
                onChange={e => { setPanelDueDate(e.target.value); setPanelDirty(true) }}
                className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all w-full"
              />
            </div>

            {/* 설명 */}
            <div>
              <label className="block text-[11px] font-medium text-gray-400 mb-1">설명</label>
              <AutoTextarea
                value={panelBody}
                onChange={v => { setPanelBody(v); setPanelDirty(true) }}
                placeholder="태스크 설명..."
              />
            </div>

            {/* 메모 */}
            <div>
              <label className="block text-[11px] font-medium text-gray-400 mb-1">메모</label>
              <AutoTextarea
                value={panelNotes}
                onChange={v => { setPanelNotes(v); setPanelDirty(true) }}
                placeholder="메모..."
              />
            </div>

            {/* 체크리스트 */}
            {checklist.length > 0 && (
              <div>
                <label className="block text-[11px] font-medium text-gray-400 mb-2">
                  체크리스트 <span className="text-gray-300 font-normal">({completedCount}/{checklist.length})</span>
                </label>
                <div className="space-y-1.5">
                  {checklist.map(item => (
                    <div key={item.id} className={cn('flex items-center gap-2 text-xs', item.completed ? 'text-gray-400 line-through' : 'text-gray-700')}>
                      {item.completed
                        ? <CheckSquare size={12} className="text-green-400 shrink-0" />
                        : <Square size={12} className="text-gray-300 shrink-0" />}
                      {item.text}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 푸터 액션 */}
          <div className="px-5 py-4 border-t border-gray-100 space-y-2 shrink-0">
            {panelDirty && (
              <button
                onClick={() => updateTaskMutation.mutate()}
                disabled={updateTaskMutation.isPending || !panelTitle.trim()}
                className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-700 disabled:opacity-40 transition-colors"
              >
                {updateTaskMutation.isPending ? '저장 중...' : '변경사항 저장'}
              </button>
            )}
            {doneColByProject[task.project_id] && (
              <button
                onClick={() => completeTaskMutation.mutate()}
                disabled={completeTaskMutation.isPending}
                className="w-full py-2.5 border-2 border-green-200 text-green-600 bg-green-50 hover:bg-green-100 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={14} />
                {completeTaskMutation.isPending ? '처리 중...' : '완료 처리'}
              </button>
            )}
          </div>
        </div>
      )
    }

    // post panel
    const post = selected.item
    const proj = projMap[selected.projectId]
    const isIssue = post.type === 'issue'
    const isOpen  = post.status === 'open'

    return (
      <div className="sticky top-8 bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col max-h-[calc(100vh-4rem)]">
        {/* 헤더 */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 bg-gray-50 shrink-0">
          {proj && <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: proj.color }} />}
          <span className="text-xs font-semibold text-gray-500 flex-1 truncate">{proj?.name}</span>
          <Link
            href={`/projects/${selected.projectId}/issues`}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ExternalLink size={11} /> 이슈 페이지
          </Link>
          <button onClick={() => setSelected(null)} className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* 스크롤 본문 */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {/* 타입 + 상태 */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              'text-xs font-semibold px-2.5 py-1 rounded-full',
              isIssue
                ? isOpen ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                : 'bg-indigo-100 text-indigo-600'
            )}>
              {isIssue ? (isOpen ? '열린 이슈' : '닫힌 이슈') : '기록'}
            </span>
            {isIssue && (
              <button
                onClick={() => togglePostStatusMutation.mutate({
                  postId: post.id,
                  status: isOpen ? 'closed' : 'open',
                })}
                className={cn(
                  'text-xs px-2.5 py-1 rounded-full border font-medium transition-colors',
                  isOpen
                    ? 'border-green-200 text-green-600 hover:bg-green-50'
                    : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                )}
              >
                {isOpen ? '이슈 닫기' : '다시 열기'}
              </button>
            )}
            <span className="text-[11px] text-gray-400 ml-auto">{fmtTimestamp(post.created_at)}</span>
          </div>

          {/* 제목 */}
          <div>
            <label className="block text-[11px] font-medium text-gray-400 mb-1">제목</label>
            <input
              value={panelTitle}
              onChange={e => { setPanelTitle(e.target.value); setPanelDirty(true) }}
              className="w-full text-sm font-semibold border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all"
            />
          </div>

          {/* 우선순위 (이슈만) */}
          {isIssue && (
            <div>
              <label className="block text-[11px] font-medium text-gray-400 mb-2">우선순위</label>
              <div className="flex gap-2 flex-wrap">
                {(Object.keys(PRIORITY_META) as TaskPriority[]).map(p => (
                  <button key={p}
                    onClick={() => { setPanelPriority(p); setPanelDirty(true) }}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all',
                      PRIORITY_META[p].className,
                      panelPriority === p ? 'border-gray-500 ring-2 ring-offset-1 ring-gray-200' : 'border-transparent'
                    )}
                  >
                    {PRIORITY_META[p].label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 내용 */}
          <div>
            <label className="block text-[11px] font-medium text-gray-400 mb-1">내용</label>
            <AutoTextarea
              value={panelBody}
              onChange={v => { setPanelBody(v); setPanelDirty(true) }}
              placeholder={isIssue ? '이슈 상세 내용...' : '기록 내용...'}
              className="min-h-[120px]"
            />
          </div>
        </div>

        {/* 푸터 */}
        {panelDirty && (
          <div className="px-5 py-4 border-t border-gray-100 shrink-0">
            <button
              onClick={() => updatePostMutation.mutate()}
              disabled={updatePostMutation.isPending || !panelTitle.trim()}
              className="w-full py-2.5 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              {updatePostMutation.isPending ? '저장 중...' : '변경사항 저장'}
            </button>
          </div>
        )}
      </div>
    )
  }

  // 선택된 아이템이 있으면 2컬럼 레이아웃
  const hasPanel = selected !== null

  return (
    <div className={cn('p-8 mx-auto transition-all', hasPanel ? 'max-w-7xl' : 'max-w-5xl')}>
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">전체 현황</h1>
        <p className="text-sm text-gray-400">모든 프로젝트의 진행 상태</p>
      </div>

      <div className={cn('flex gap-6 items-start', hasPanel ? '' : '')}>
        {/* ── 왼쪽: 메인 리스트 ── */}
        <div className="flex-1 min-w-0">
          {/* 뷰 탭 */}
          <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
            <button
              onClick={() => { setView('tasks'); setSelected(null) }}
              className={cn('flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
                view === 'tasks' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}
            >
              <CheckSquare size={14} /> 태스크 현황
            </button>
            <button
              onClick={() => { setView('issues'); setSelected(null) }}
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
              <div className="flex items-center gap-2 mb-6 flex-wrap">
                {TASK_FILTERS.map(f => (
                  <button key={f.key} onClick={() => setFilter(f.key)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                      filter === f.key ? 'bg-gray-900 text-white border-transparent' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                    )}
                  >
                    {f.label}
                    {f.count > 0 && (
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                        filter === f.key ? 'bg-white/20 text-white' : 'bg-gray-100 ' + f.className)}>
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
                    const isCollapsed  = collapsed.has(p.id)
                    const overdueCount = tasks.filter(t => {
                      if (!t.due_date || t.task_type === 'meeting') return false
                      const d = new Date(t.due_date); d.setHours(0, 0, 0, 0); return d < today
                    }).length
                    const urgentCount = tasks.filter(t => t.priority === 'urgent').length

                    return (
                      <div key={p.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                        {/* 프로젝트 헤더 */}
                        <div
                          onClick={() => toggleCollapse(p.id)}
                          className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
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
                            className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                          >
                            열기 →
                          </span>
                          {isCollapsed
                            ? <ChevronRight size={14} className="text-gray-400 shrink-0" />
                            : <ChevronDown size={14} className="text-gray-400 shrink-0" />}
                        </div>

                        {!isCollapsed && (
                          <div className="divide-y divide-gray-50 border-t border-gray-100">
                            {tasks.map(task => {
                              const col = colMap[task.status]
                              const pm  = PRIORITY_META[task.priority]
                              const isSelected = selected?.kind === 'task' && selected.item.id === task.id
                              const isOverdue = task.due_date && task.task_type !== 'meeting' && (() => {
                                const d = new Date(task.due_date); d.setHours(0, 0, 0, 0); return d < today
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
                                  onClick={() => setSelected(isSelected ? null : { kind: 'task', item: task })}
                                  className={cn(
                                    'w-full flex items-center gap-3 px-5 py-3 transition-colors text-left group',
                                    isSelected ? 'bg-blue-50 border-l-2 border-blue-400' : 'hover:bg-gray-50'
                                  )}
                                >
                                  <div className={cn('w-1.5 h-1.5 rounded-full shrink-0 transition-colors',
                                    isSelected ? 'bg-blue-400' : 'bg-gray-300 group-hover:bg-gray-500')} />
                                  <span className="flex-1 text-sm text-gray-700 truncate">{task.title}</span>
                                  {col && <span className="text-[10px] text-gray-400 shrink-0 hidden sm:block">{col.name}</span>}
                                  {checklist.length > 0 && (
                                    <span className="text-[10px] text-gray-400 shrink-0 flex items-center gap-0.5">
                                      <CheckSquare size={10} /> {completedChecklist}/{checklist.length}
                                    </span>
                                  )}
                                  {task.due_date && (
                                    <span className={cn('flex items-center gap-0.5 text-xs shrink-0',
                                      isOverdue ? 'text-red-500' : isToday ? 'text-orange-500' : 'text-gray-400')}>
                                      <CalendarDays size={11} />
                                      {isOverdue ? '기한 초과' : isToday ? '오늘 마감' : fmtDate(task.due_date)}
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
              <div className="flex items-center gap-2 mb-6 flex-wrap">
                {ISSUE_FILTERS.map(f => (
                  <button key={f.key} onClick={() => setIssueFilter(f.key)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                      issueFilter === f.key ? 'bg-gray-900 text-white border-transparent' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                    )}
                  >
                    {f.label}
                    {f.count > 0 && (
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                        issueFilter === f.key ? 'bg-white/20 text-white' : 'bg-gray-100 ' + f.className)}>
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
                    const openCount   = posts.filter(p => p.type === 'issue' && p.status === 'open').length

                    return (
                      <div key={p.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                        <div
                          onClick={() => toggleCollapse(`issue-${p.id}`)}
                          className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
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
                          {isCollapsed
                            ? <ChevronRight size={14} className="text-gray-400 shrink-0" />
                            : <ChevronDown size={14} className="text-gray-400 shrink-0" />}
                        </div>

                        {!isCollapsed && (
                          <div className="divide-y divide-gray-50 border-t border-gray-100">
                            {posts.map(post => {
                              const isNote     = post.type === 'note'
                              const isOpen     = post.status === 'open'
                              const pm         = PRIORITY_META[post.priority as keyof typeof PRIORITY_META]
                              const isSelected = selected?.kind === 'post' && selected.item.id === post.id

                              return (
                                <button
                                  key={post.id}
                                  onClick={() => setSelected(isSelected ? null : { kind: 'post', item: post, projectId: p.id })}
                                  className={cn(
                                    'w-full flex items-center gap-3 px-5 py-3 transition-colors text-left group',
                                    isSelected ? 'bg-blue-50 border-l-2 border-blue-400' : 'hover:bg-gray-50'
                                  )}
                                >
                                  {isNote
                                    ? <FileText size={13} className={cn('shrink-0', isSelected ? 'text-blue-400' : 'text-purple-400')} />
                                    : <MessageSquare size={13} className={cn('shrink-0',
                                        isSelected ? 'text-blue-400' : isOpen ? 'text-blue-500' : 'text-gray-400')} />}
                                  <span className="flex-1 text-sm text-gray-700 truncate">{post.title}</span>
                                  {isNote ? (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 font-medium shrink-0">기록</span>
                                  ) : (
                                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0',
                                      isOpen ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500')}>
                                      {isOpen ? '열림' : '닫힘'}
                                    </span>
                                  )}
                                  {!isNote && post.priority !== 'normal' && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${pm.className}`}>
                                      {pm.label}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-gray-400 shrink-0">{fmtDate(post.created_at)}</span>
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
        </div>

        {/* ── 오른쪽: 디테일 패널 ── */}
        {hasPanel && (
          <div className="w-[540px] shrink-0">
            <DetailPanel />
          </div>
        )}
      </div>
    </div>
  )
}
