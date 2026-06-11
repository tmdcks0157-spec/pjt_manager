'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Task, Project, CalendarEvent, TaskPriority } from '@/types'
import { ChevronLeft, ChevronRight, CalendarDays, X, ExternalLink, Plus, Trash2, SlidersHorizontal, Check, LayoutGrid, AlignJustify, ChevronDown, ChevronUp, CheckSquare, Square, Users } from 'lucide-react'
import Link from 'next/link'

// ───────── 공휴일 ─────────
const HOLIDAYS: Record<string, string> = {
  '2025-01-01': '신정',
  '2025-01-27': '설날 연휴', '2025-01-28': '설날', '2025-01-29': '설날 연휴', '2025-01-30': '설날 대체공휴일',
  '2025-03-01': '삼일절',
  '2025-05-05': '어린이날 · 부처님오신날', '2025-05-06': '대체공휴일',
  '2025-06-06': '현충일', '2025-08-15': '광복절', '2025-10-03': '개천절',
  '2025-10-05': '추석 연휴', '2025-10-06': '추석', '2025-10-07': '추석 연휴', '2025-10-08': '추석 대체공휴일',
  '2025-10-09': '한글날', '2025-12-25': '성탄절',
  '2026-01-01': '신정',
  '2026-02-16': '설날 연휴', '2026-02-17': '설날', '2026-02-18': '설날 연휴',
  '2026-03-01': '삼일절', '2026-03-02': '삼일절 대체공휴일',
  '2026-05-05': '어린이날', '2026-05-24': '부처님오신날', '2026-05-25': '부처님오신날 대체공휴일',
  '2026-06-03': '전국동시지방선거', '2026-06-06': '현충일',
  '2026-08-15': '광복절', '2026-08-17': '광복절 대체공휴일',
  '2026-09-24': '추석 연휴', '2026-09-25': '추석', '2026-09-26': '추석 연휴',
  '2026-10-03': '개천절', '2026-10-09': '한글날', '2026-12-25': '성탄절',
}

// ───────── constants ─────────
const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-red-500', high: 'bg-orange-400', normal: 'bg-blue-400', low: 'bg-gray-300',
}
const PRIORITY_LABEL: Record<string, string> = {
  urgent: '긴급', high: '높음', normal: '보통', low: '낮음',
}
const PRIORITY_BADGE: Record<string, string> = {
  urgent: 'bg-red-100 text-red-600', high: 'bg-orange-100 text-orange-600',
  normal: 'bg-blue-100 text-blue-600', low: 'bg-gray-100 text-gray-500',
}
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
const EVENT_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#14b8a6']
const MONTH_LABELS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

const TAG_COLORS = [
  'bg-blue-100 text-blue-700', 'bg-green-100 text-green-700',
  'bg-purple-100 text-purple-700', 'bg-pink-100 text-pink-700',
  'bg-amber-100 text-amber-700', 'bg-teal-100 text-teal-700',
  'bg-orange-100 text-orange-700', 'bg-indigo-100 text-indigo-700',
]
function tagColor(tag: string) {
  let h = 0
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0
  return TAG_COLORS[h % TAG_COLORS.length]
}

type DueStatus = 'overdue' | 'today' | 'tomorrow' | null
function getDueStatus(dueDate: string | null): DueStatus {
  if (!dueDate) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate); due.setHours(0, 0, 0, 0)
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000)
  if (diff < 0) return 'overdue'
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  return null
}
const DUE_STATUS_META = {
  overdue:  { badgeClass: 'text-red-500',    label: '기한 초과' },
  today:    { badgeClass: 'text-orange-500', label: '오늘 마감' },
  tomorrow: { badgeClass: 'text-yellow-600', label: '내일 마감' },
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function getWeekSunday(date: Date): Date {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  d.setHours(0, 0, 0, 0)
  return d
}

// ───────── SidebarTaskCard ─────────
function SidebarTaskCard({ task, proj }: { task: Task; proj?: Project }) {
  const [expanded, setExpanded] = useState(() => {
    try {
      const stored: string[] = JSON.parse(localStorage.getItem('expanded-cal-cards') ?? '[]')
      return stored.includes(task.id)
    } catch { return false }
  })

  function toggleExpanded() {
    setExpanded(v => {
      const next = !v
      try {
        const stored = new Set<string>(JSON.parse(localStorage.getItem('expanded-cal-cards') ?? '[]'))
        next ? stored.add(task.id) : stored.delete(task.id)
        localStorage.setItem('expanded-cal-cards', JSON.stringify([...stored]))
      } catch {}
      return next
    })
  }
  const isMeeting = task.task_type === 'meeting'
  const dueStatus = isMeeting ? null : getDueStatus(task.due_date)
  const dueMeta = dueStatus ? DUE_STATUS_META[dueStatus] : null
  const checklist = task.checklist_items ?? []
  const completedCount = checklist.filter(i => i.completed).length
  const hasExpandable = !!task.description?.trim() || checklist.length > 0

  return (
    <div className={`p-3 rounded-xl border transition-colors ${isMeeting ? 'border-indigo-100 bg-indigo-50' : dueMeta ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-white'}`}>
      {/* 제목 행 */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-800 leading-snug flex-1">{task.title}</p>
        <Link href={`/projects/${task.project_id}`}
          className="text-gray-300 hover:text-blue-500 transition-colors shrink-0 mt-0.5">
          <ExternalLink size={13} />
        </Link>
      </div>

      {/* 배지 행 */}
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {isMeeting && (
          <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-600">
            <Users size={10} /> 일정
          </span>
        )}
        {!isMeeting && task.priority !== 'normal' && (
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_BADGE[task.priority]}`}>
            {PRIORITY_LABEL[task.priority]}
          </span>
        )}
        {task.due_date && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ${dueMeta ? dueMeta.badgeClass : 'text-gray-400'}`}>
            <CalendarDays size={11} />
            {dueMeta ? dueMeta.label : new Date(task.due_date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
          </span>
        )}
        {checklist.length > 0 && (
          <span className="flex items-center gap-0.5 text-xs text-gray-400">
            <CheckSquare size={11} />
            {completedCount}/{checklist.length}
          </span>
        )}
        {proj && (
          <span className="flex items-center gap-1 text-xs text-gray-500 ml-auto">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: proj.color }} />
            {proj.name}
          </span>
        )}
        {hasExpandable && (
          <button onClick={toggleExpanded}
            className="text-gray-300 hover:text-gray-500 transition-colors ml-auto">
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        )}
      </div>

      {/* 펼쳐진 내용 */}
      {expanded && (
        <div className="mt-2 space-y-2 border-t border-gray-100 pt-2">
          {task.description?.trim() && (
            <p className="text-xs text-gray-500 leading-relaxed whitespace-pre-line">{task.description}</p>
          )}
          {checklist.length > 0 && (
            <div className="space-y-1">
              <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-green-400 rounded-full"
                  style={{ width: `${(completedCount / checklist.length) * 100}%` }} />
              </div>
              {checklist.slice(0, 4).map(item => (
                <div key={item.id} className="flex items-center gap-1.5 text-xs">
                  {item.completed
                    ? <CheckSquare size={12} className="text-green-500 shrink-0" />
                    : <Square size={12} className="text-gray-300 shrink-0" />}
                  <span className={item.completed ? 'line-through text-gray-400' : 'text-gray-600'}>{item.text}</span>
                </div>
              ))}
              {checklist.length > 4 && <p className="text-xs text-gray-400 pl-4">+{checklist.length - 4}개 더</p>}
            </div>
          )}
        </div>
      )}

      {/* 태그 */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {task.tags.slice(0, 3).map(t => (
            <span key={t} className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${tagColor(t)}`}>{t}</span>
          ))}
          {task.tags.length > 3 && <span className="text-xs text-gray-400 self-center">+{task.tags.length - 3}</span>}
        </div>
      )}
    </div>
  )
}

// ───────── QuickTaskModal ─────────
const PRIORITY_OPTIONS: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'urgent', label: '긴급', color: 'text-red-500' },
  { value: 'high',   label: '높음', color: 'text-orange-500' },
  { value: 'normal', label: '보통', color: 'text-blue-500' },
  { value: 'low',    label: '낮음', color: 'text-gray-400' },
]

function QuickTaskModal({ date, projects, onClose, onSave }: {
  date: string
  projects: Project[]
  onClose: () => void
  onSave: (title: string, projectId: string, priority: TaskPriority, dueDate: string) => void
}) {
  const [title, setTitle]       = useState('')
  const [projectId, setProject] = useState(projects[0]?.id ?? '')
  const [priority, setPriority] = useState<TaskPriority>('normal')
  const [dueDate, setDueDate]   = useState(date)

  function handleSave() {
    if (!title.trim() || !projectId) return
    onSave(title.trim(), projectId, priority, dueDate)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-88 p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">태스크 추가</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        <div className="space-y-3">
          <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
            placeholder="태스크 이름..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">프로젝트</label>
              <select value={projectId} onChange={e => setProject(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white">
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">우선순위</label>
              <select value={priority} onChange={e => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white">
                {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">마감일</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={handleSave} disabled={!title.trim() || !projectId}
            className="flex-1 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors">
            추가
          </button>
          <button onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors">취소</button>
        </div>
      </div>
    </div>
  )
}

// ───────── EventModal ─────────
function EventModal({ initialDate, event, onClose, onSave, onDelete }: {
  initialDate: string; event?: CalendarEvent
  onClose: () => void; onSave: (data: Partial<CalendarEvent>) => void; onDelete?: () => void
}) {
  const [title, setTitle]      = useState(event?.title ?? '')
  const [date, setDate]        = useState(event?.date ?? initialDate)
  const [endDate, setEndDate]  = useState(event?.end_date ?? '')
  const [color, setColor]      = useState(event?.color ?? EVENT_COLORS[0])
  const [description, setDesc] = useState(event?.description ?? '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-96 p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">{event ? '일정 편집' : '일정 추가'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">제목</label>
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && title.trim()) { onSave({ title, date, end_date: endDate || null, color, description }); onClose() } }}
              placeholder="일정 이름..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">날짜</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">종료일 <span className="text-gray-300">(선택)</span></label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">색상</label>
            <div className="flex gap-2 flex-wrap">
              {EVENT_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-full border-2 transition-all"
                  style={{ backgroundColor: c, borderColor: color === c ? '#111827' : 'transparent' }} />
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">메모 <span className="text-gray-300">(선택)</span></label>
            <textarea value={description} onChange={e => setDesc(e.target.value)}
              placeholder="내용..." rows={2}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none" />
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={() => { onSave({ title, date, end_date: endDate || null, color, description }); onClose() }}
            disabled={!title.trim()}
            className="flex-1 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors">
            저장
          </button>
          {onDelete && (
            <button onClick={() => { onDelete(); onClose() }}
              className="px-4 py-2 border border-gray-200 text-red-400 rounded-lg text-sm hover:bg-red-50 transition-colors">
              <Trash2 size={14} />
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors">취소</button>
        </div>
      </div>
    </div>
  )
}

// ───────── Page ─────────
export default function CalendarPage() {
  const today = new Date()
  const queryClient = useQueryClient()
  const [viewMode, setViewMode]         = useState<'month' | 'week'>('month')
  const [current, setCurrent]           = useState({ year: today.getFullYear(), month: today.getMonth() })
  const [weekStart, setWeekStart]       = useState<Date>(() => getWeekSunday(today))
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showEventModal, setShowEventModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>()
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [pickerYear, setPickerYear]     = useState(today.getFullYear())
  const [showFilter, setShowFilter]     = useState(false)
  const [hiddenProjects, setHiddenProjects] = useState<Set<string>>(new Set())
  const [draggingTask, setDraggingTask]     = useState<Task | null>(null)
  const [dragOverKey, setDragOverKey]       = useState<string | null>(null)
  const [noDueOpen, setNoDueOpen]           = useState(true)
  const [summaryOpen, setSummaryOpen]       = useState(true)
  const [quickTaskDate, setQuickTaskDate]   = useState<string | null>(null)

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').order('created_at')
      if (error) throw error; return data
    },
  })
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ['all-tasks-calendar'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tasks').select('*, checklist_items(*)').not('due_date', 'is', null).is('deleted_at', null).eq('archived', false)
      if (error) throw error; return data
    },
  })
  const { data: doneColumnIds = new Set<string>() } = useQuery<Set<string>>({
    queryKey: ['done-column-ids'],
    queryFn: async () => {
      const { data, error } = await supabase.from('columns').select('id, name')
      if (error) throw error
      return new Set((data ?? []).filter(c => c.name === '완료').map(c => c.id))
    },
  })
  const { data: events = [] } = useQuery<CalendarEvent[]>({
    queryKey: ['calendar-events'],
    queryFn: async () => {
      const { data, error } = await supabase.from('calendar_events').select('*').order('date')
      if (error) throw error; return data
    },
  })
  const { data: noDueTasks = [] } = useQuery<Task[]>({
    queryKey: ['tasks-no-due'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tasks').select('*').is('due_date', null).is('deleted_at', null).eq('archived', false).order('created_at')
      if (error) throw error; return data
    },
  })

  const setDueDateMutation = useMutation({
    mutationFn: async ({ id, due_date }: { id: string; due_date: string }) => {
      const { error } = await supabase.from('tasks').update({ due_date }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-tasks-calendar'] })
      queryClient.invalidateQueries({ queryKey: ['tasks-no-due'] })
    },
  })
  const createEventMutation = useMutation({
    mutationFn: async (body: Partial<CalendarEvent>) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('calendar_events').insert({ ...body, user_id: user!.id })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar-events'] }),
  })
  const updateEventMutation = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Partial<CalendarEvent> }) => {
      const { error } = await supabase.from('calendar_events').update(body).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar-events'] }),
  })
  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('calendar_events').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['calendar-events'] }),
  })

  const createTaskMutation = useMutation({
    mutationFn: async ({ title, projectId, priority, dueDate }: { title: string; projectId: string; priority: TaskPriority; dueDate: string }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: cols } = await supabase.from('columns').select('id').eq('project_id', projectId).order('order').limit(1)
      const columnId = cols?.[0]?.id
      if (!columnId) throw new Error('프로젝트에 컬럼이 없습니다')
      const { error } = await supabase.from('tasks').insert({
        title, project_id: projectId, user_id: user!.id,
        status: columnId, priority, due_date: dueDate,
        description: '', notes: '', tags: [], order: 0, archived: false,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-tasks-calendar'] })
      queryClient.invalidateQueries({ queryKey: ['tasks-no-due'] })
    },
  })

  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]))

  function toggleProject(id: string) {
    setHiddenProjects(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAllProjects() {
    setHiddenProjects(prev => prev.size === 0 ? new Set(projects.map(p => p.id)) : new Set())
  }

  const filteredTasks = hiddenProjects.size === 0 ? tasks : tasks.filter(t => !hiddenProjects.has(t.project_id))

  const tasksByDate: Record<string, Task[]> = {}
  filteredTasks.forEach(t => {
    if (!t.due_date) return
    const key = toDateKey(new Date(t.due_date))
    if (!tasksByDate[key]) tasksByDate[key] = []
    tasksByDate[key].push(t)
  })
  const eventsByDate: Record<string, CalendarEvent[]> = {}
  events.forEach(ev => {
    const start = new Date(ev.date)
    const end   = ev.end_date ? new Date(ev.end_date) : start
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = toDateKey(new Date(d))
      if (!eventsByDate[key]) eventsByDate[key] = []
      eventsByDate[key].push(ev)
    }
  })

  // ── 월간 계산 ──
  const firstDay   = new Date(current.year, current.month, 1)
  const lastDay    = new Date(current.year, current.month + 1, 0)
  const startPad   = firstDay.getDay()
  const totalCells = Math.ceil((startPad + lastDay.getDate()) / 7) * 7
  const monthCells: (Date | null)[] = Array.from({ length: totalCells }, (_, i) => {
    const d = i - startPad + 1
    if (d < 1 || d > lastDay.getDate()) return null
    return new Date(current.year, current.month, d)
  })

  // ── 주간 계산 ──
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })
  const weekEnd = weekDays[6]
  const weekLabel = weekStart.getMonth() === weekEnd.getMonth()
    ? `${weekStart.getFullYear()}년 ${weekStart.getMonth() + 1}월 ${weekStart.getDate()}일 ~ ${weekEnd.getDate()}일`
    : `${weekStart.getFullYear()}년 ${weekStart.getMonth() + 1}월 ${weekStart.getDate()}일 ~ ${weekEnd.getMonth() + 1}월 ${weekEnd.getDate()}일`

  // ── 마감 요약 ──
  const thisWeekSun = getWeekSunday(today)
  const thisWeekSat = new Date(thisWeekSun); thisWeekSat.setDate(thisWeekSat.getDate() + 6)

  const activeTasks   = filteredTasks.filter(t => !doneColumnIds.has(t.status) && t.task_type !== 'meeting')
  const todayDueTasks = activeTasks.filter(t => t.due_date && toDateKey(new Date(t.due_date)) === toDateKey(today))
  const weekDueTasks  = activeTasks.filter(t => {
    if (!t.due_date) return false
    const d = new Date(t.due_date); d.setHours(0,0,0,0)
    return d >= thisWeekSun && d <= thisWeekSat && toDateKey(d) !== toDateKey(today)
  })
  const overdueTasks  = activeTasks.filter(t => {
    if (!t.due_date) return false
    const d = new Date(t.due_date); d.setHours(0,0,0,0)
    return d < new Date(today.setHours(0,0,0,0))
  })

  // ── 공통 ──
  const todayKey      = toDateKey(today)
  const selectedKey   = selectedDate ? toDateKey(selectedDate) : null
  const selectedTasks = selectedKey ? (tasksByDate[selectedKey] ?? []) : []
  const selectedEvents = selectedKey ? (eventsByDate[selectedKey] ?? []) : []
  const selectedHoliday = selectedKey ? HOLIDAYS[selectedKey] : null

  const monthLabel = new Date(current.year, current.month, 1).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })

  function prevMonth() { setCurrent(p => { const m = p.month - 1; return m < 0 ? { year: p.year - 1, month: 11 } : { year: p.year, month: m } }); setSelectedDate(null) }
  function nextMonth() { setCurrent(p => { const m = p.month + 1; return m > 11 ? { year: p.year + 1, month: 0 } : { year: p.year, month: m } }); setSelectedDate(null) }
  function prevWeek()  { setWeekStart(p => { const d = new Date(p); d.setDate(d.getDate() - 7); return d }); setSelectedDate(null) }
  function nextWeek()  { setWeekStart(p => { const d = new Date(p); d.setDate(d.getDate() + 7); return d }); setSelectedDate(null) }

  function goToToday() {
    setCurrent({ year: today.getFullYear(), month: today.getMonth() })
    setWeekStart(getWeekSunday(today))
    setSelectedDate(null)
  }
  function switchToWeek() {
    const base = selectedDate ?? today
    setWeekStart(getWeekSunday(base))
    setViewMode('week')
  }
  function switchToMonth() {
    setCurrent({ year: weekStart.getFullYear(), month: weekStart.getMonth() })
    setViewMode('month')
  }
  function openPicker() { setPickerYear(current.year); setShowDatePicker(true) }
  function pickMonth(month: number) { setCurrent({ year: pickerYear, month }); setSelectedDate(null); setShowDatePicker(false) }

  // ── 드롭 공통 핸들러 ──
  function handleDrop(e: React.DragEvent, key: string | null) {
    e.preventDefault()
    if (!draggingTask || !key) return
    setDueDateMutation.mutate({ id: draggingTask.id, due_date: key })
    setDraggingTask(null); setDragOverKey(null)
  }

  // ── 셀 공통 렌더 ──
  function renderCellContent(date: Date, isWeekView = false) {
    const key       = toDateKey(date)
    const holiday   = HOLIDAYS[key]
    const dayTasks  = tasksByDate[key] ?? []
    const dayEvents = eventsByDate[key] ?? []
    const isToday   = key === todayKey
    const isSelected = key === selectedKey
    const isSun     = date.getDay() === 0
    const isSat     = date.getDay() === 6
    const isDragOver = draggingTask && key === dragOverKey
    const canAddTask = projects.length > 0

    return (
      <div
        key={key}
        onClick={() => setSelectedDate(isSelected ? null : date)}
        onDragOver={e => { if (!draggingTask) return; e.preventDefault(); setDragOverKey(key) }}
        onDragLeave={() => setDragOverKey(null)}
        onDrop={e => handleDrop(e, key)}
        className={`${isWeekView ? 'min-h-48' : 'min-h-28'} p-2 transition-colors cursor-pointer
          ${isDragOver ? 'bg-green-50 ring-2 ring-green-300 ring-inset' : ''}
          ${!isDragOver && isSelected ? 'bg-blue-50' : ''}
          ${!isDragOver && !isSelected && draggingTask ? 'hover:bg-green-50 cursor-copy' : ''}
          ${!isDragOver && !isSelected && !draggingTask ? 'hover:bg-gray-50' : ''}
        `}
      >
        {/* 날짜 헤더 — 주간 뷰는 헤더에 날짜가 있으므로 공휴일 이름만 표시 */}
        {isWeekView ? (
          <div className="flex items-center justify-between mb-1 group/cell min-h-5">
            <span className="text-xs text-red-400 truncate flex-1">{holiday ?? ''}</span>
            {canAddTask && (
              <button
                onClick={e => { e.stopPropagation(); setQuickTaskDate(key) }}
                className="opacity-0 group-hover/cell:opacity-100 transition-opacity p-0.5 text-gray-300 hover:text-gray-600 hover:bg-gray-100 rounded shrink-0">
                <Plus size={12} />
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between mb-1 group/cell">
            <span className="text-xs text-red-400 truncate flex-1 leading-none">{holiday ?? ''}</span>
            {canAddTask && (
              <button
                onClick={e => { e.stopPropagation(); setQuickTaskDate(key) }}
                className="opacity-0 group-hover/cell:opacity-100 transition-opacity p-0.5 text-gray-300 hover:text-gray-600 hover:bg-gray-100 rounded mr-1 shrink-0">
                <Plus size={12} />
              </button>
            )}
            <span className={`text-xs w-6 h-6 flex items-center justify-center rounded-full font-medium shrink-0
              ${isToday ? 'bg-gray-900 text-white' : (isSun || holiday) ? 'text-red-400' : isSat ? 'text-blue-400' : 'text-gray-600'}`}>
              {date.getDate()}
            </span>
          </div>
        )}

        {/* 이벤트 + 태스크 */}
        <div className="space-y-0.5">
          {(isWeekView ? dayEvents : dayEvents.slice(0, 2)).map(ev => (
            <div key={ev.id} className="px-1.5 py-0.5 rounded text-xs font-medium text-white truncate"
              style={{ backgroundColor: ev.color }}
              onClick={e => { e.stopPropagation(); setEditingEvent(ev); setShowEventModal(true) }}>
              {ev.title}
            </div>
          ))}
          {(isWeekView ? dayTasks : dayTasks.slice(0, 2)).map(task => (
            <div key={task.id} className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded-md ${task.task_type === 'meeting' ? 'bg-indigo-50' : ''}`}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${task.task_type === 'meeting' ? 'bg-indigo-400' : PRIORITY_DOT[task.priority]}`} />
              <span className={`text-xs truncate flex-1 leading-tight ${task.task_type === 'meeting' ? 'text-indigo-700' : 'text-gray-700'}`}>{task.title}</span>
            </div>
          ))}
          {!isWeekView && (dayEvents.length + dayTasks.length) > 4 && (
            <p className="text-xs text-gray-400 px-1.5">+{dayEvents.length + dayTasks.length - 4}개 더</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {showEventModal && (
        <EventModal
          initialDate={selectedKey ?? toDateKey(today)}
          event={editingEvent}
          onClose={() => { setShowEventModal(false); setEditingEvent(undefined) }}
          onSave={data => {
            if (editingEvent) updateEventMutation.mutate({ id: editingEvent.id, body: data })
            else createEventMutation.mutate(data)
          }}
          onDelete={editingEvent ? () => deleteEventMutation.mutate(editingEvent.id) : undefined}
        />
      )}

      {/* 연도-월 피커 */}
      {showDatePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={() => setShowDatePicker(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-5 w-72" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setPickerYear(y => y - 1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronLeft size={15} /></button>
              <span className="text-sm font-bold">{pickerYear}년</span>
              <button onClick={() => setPickerYear(y => y + 1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronRight size={15} /></button>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {MONTH_LABELS.map((label, idx) => {
                const isCurrent = pickerYear === current.year && idx === current.month
                const isThisMonth = pickerYear === today.getFullYear() && idx === today.getMonth()
                return (
                  <button key={idx} onClick={() => pickMonth(idx)}
                    className={`py-2.5 rounded-xl text-sm font-medium transition-colors
                      ${isCurrent ? 'bg-gray-900 text-white' : isThisMonth ? 'border border-gray-300 text-gray-700 hover:bg-gray-100' : 'text-gray-600 hover:bg-gray-100'}`}>
                    {label}
                  </button>
                )
              })}
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <button onClick={() => { goToToday(); setShowDatePicker(false) }}
                className="w-full py-2 text-xs text-gray-500 hover:bg-gray-50 rounded-lg transition-colors">오늘로 이동</button>
            </div>
          </div>
        </div>
      )}

      {quickTaskDate && (
        <QuickTaskModal
          date={quickTaskDate}
          projects={projects}
          onClose={() => setQuickTaskDate(null)}
          onSave={(title, projectId, priority, dueDate) =>
            createTaskMutation.mutate({ title, projectId, priority, dueDate })
          }
        />
      )}

      {/* 헤더 */}
      <div className="px-8 py-5 border-b border-gray-200 bg-white flex items-center gap-4">
        <CalendarDays size={18} className="text-gray-400" />
        <h1 className="text-lg font-bold">캘린더</h1>
        <div className="ml-auto flex items-center gap-2">

          {/* 뷰 토글 */}
          <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden mr-1">
            <button onClick={() => viewMode === 'week' ? switchToMonth() : undefined}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors
                ${viewMode === 'month' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              <LayoutGrid size={13} /> 월간
            </button>
            <button onClick={() => viewMode === 'month' ? switchToWeek() : undefined}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors
                ${viewMode === 'week' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              <AlignJustify size={13} /> 주간
            </button>
          </div>

          {/* 네비게이션 */}
          <button onClick={viewMode === 'month' ? prevMonth : prevWeek}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"><ChevronLeft size={16} /></button>
          {viewMode === 'month' ? (
            <button onClick={openPicker}
              className="text-sm font-semibold w-36 text-center px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors">
              {monthLabel}
            </button>
          ) : (
            <span className="text-sm font-semibold w-56 text-center px-2">{weekLabel}</span>
          )}
          <button onClick={viewMode === 'month' ? nextMonth : nextWeek}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"><ChevronRight size={16} /></button>

          {/* 프로젝트 필터 */}
          <div className="relative ml-1">
            <button onClick={() => setShowFilter(f => !f)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 border rounded-lg transition-colors
                ${hiddenProjects.size > 0 ? 'border-blue-300 bg-blue-50 text-blue-600' : 'border-gray-200 hover:bg-gray-50 text-gray-600'}`}>
              <SlidersHorizontal size={13} />
              프로젝트 필터
              {hiddenProjects.size > 0 && (
                <span className="ml-0.5 bg-blue-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {projects.length - hiddenProjects.size}
                </span>
              )}
            </button>
            {showFilter && (
              <div className="absolute right-0 top-full mt-1.5 z-40 bg-white border border-gray-200 rounded-xl shadow-lg w-52 py-2"
                onMouseLeave={() => setShowFilter(false)}>
                <button onClick={toggleAllProjects}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 text-xs font-semibold text-gray-500">
                  <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0
                    ${hiddenProjects.size === 0 ? 'bg-gray-900 border-gray-900' : 'border-gray-300'}`}>
                    {hiddenProjects.size === 0 && <Check size={10} className="text-white" strokeWidth={3} />}
                  </span>
                  전체 프로젝트
                </button>
                <div className="border-t border-gray-100 my-1" />
                {projects.map(p => {
                  const visible = !hiddenProjects.has(p.id)
                  return (
                    <button key={p.id} onClick={() => toggleProject(p.id)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 text-xs text-gray-700">
                      <span className="w-4 h-4 rounded border flex items-center justify-center shrink-0"
                        style={{ backgroundColor: visible ? p.color : 'transparent', borderColor: visible ? p.color : '#d1d5db' }}>
                        {visible && <Check size={10} className="text-white" strokeWidth={3} />}
                      </span>
                      <span className="truncate">{p.name}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <button onClick={goToToday}
            className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">오늘</button>
          <button onClick={() => { setEditingEvent(undefined); setShowEventModal(true) }}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors">
            <Plus size={13} /> 일정 추가
          </button>
        </div>
      </div>

      {/* 본문 */}
      <div className="flex-1 overflow-auto flex">
        <div className="flex-1 overflow-auto p-6">

          {/* ── 마감 요약 패널 ── */}
          {(overdueTasks.length > 0 || todayDueTasks.length > 0 || weekDueTasks.length > 0) && (
            <div className="mb-4 bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <button onClick={() => setSummaryOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-gray-700">마감 현황</span>
                  {overdueTasks.length > 0 && (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">
                      기한 초과 {overdueTasks.length}
                    </span>
                  )}
                  {todayDueTasks.length > 0 && (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 font-medium">
                      오늘 마감 {todayDueTasks.length}
                    </span>
                  )}
                  {weekDueTasks.length > 0 && (
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-600 font-medium">
                      이번 주 {weekDueTasks.length}
                    </span>
                  )}
                </div>
                <ChevronLeft size={14} className={`text-gray-400 transition-transform ${summaryOpen ? '-rotate-90' : 'rotate-90'}`} />
              </button>

              {summaryOpen && (
                <div className="border-t border-gray-100 divide-y divide-gray-50">
                  {[
                    { label: '기한 초과', tasks: overdueTasks, badge: 'text-red-500', bg: 'bg-red-50' },
                    { label: '오늘 마감', tasks: todayDueTasks, badge: 'text-orange-500', bg: 'bg-orange-50' },
                    { label: '이번 주 마감', tasks: weekDueTasks, badge: 'text-yellow-600', bg: 'bg-yellow-50' },
                  ].filter(s => s.tasks.length > 0).map(section => (
                    <div key={section.label} className="px-4 py-3">
                      <p className={`text-xs font-semibold mb-2 ${section.badge}`}>{section.label}</p>
                      <div className="flex flex-wrap gap-2">
                        {section.tasks.map(task => {
                          const proj = projectMap[task.project_id]
                          return (
                            <div key={task.id}
                              onClick={() => task.due_date && setSelectedDate(new Date(task.due_date))}
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-100 ${section.bg} cursor-pointer hover:border-gray-200 transition-colors`}>
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT[task.priority]}`} />
                              <span className="text-xs text-gray-700 font-medium max-w-[160px] truncate">{task.title}</span>
                              {proj && (
                                <span className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: proj.color }} />
                                  {proj.name}
                                </span>
                              )}
                              {task.due_date && (
                                <span className={`text-xs shrink-0 ${section.badge}`}>
                                  {new Date(task.due_date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── 월간 뷰 ── */}
          {viewMode === 'month' && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="grid grid-cols-7 border-b border-gray-100">
                {DAY_LABELS.map((d, i) => (
                  <div key={d} className={`py-3 text-center text-xs font-semibold ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}`}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthCells.map((date, idx) => {
                  const isLastRow = idx >= totalCells - 7
                  const isLastCol = idx % 7 === 6
                  if (!date) return (
                    <div key={idx} className={`min-h-28 bg-gray-50/50 border-b border-r border-gray-100 ${isLastRow ? 'border-b-0' : ''} ${isLastCol ? 'border-r-0' : ''}`} />
                  )
                  return (
                    <div key={idx} className={`border-b border-r border-gray-100 ${isLastRow ? 'border-b-0' : ''} ${isLastCol ? 'border-r-0' : ''}`}>
                      {renderCellContent(date, false)}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── 주간 뷰 ── */}
          {viewMode === 'week' && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="grid grid-cols-7 border-b border-gray-100">
                {weekDays.map((date, i) => {
                  const key = toDateKey(date)
                  const isToday = key === todayKey
                  const isSun = i === 0
                  const isSat = i === 6
                  return (
                    <div key={i} className={`py-3 text-center border-r border-gray-100 last:border-r-0 ${isSun ? 'text-red-400' : isSat ? 'text-blue-400' : 'text-gray-400'}`}>
                      <div className="text-xs font-semibold">{DAY_LABELS[i]}</div>
                      <div className={`mx-auto mt-1 w-7 h-7 flex items-center justify-center rounded-full text-sm font-bold
                        ${isToday ? 'bg-gray-900 text-white' : ''}`}>
                        {date.getDate()}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="grid grid-cols-7 divide-x divide-gray-100">
                {weekDays.map(date => (
                  <div key={toDateKey(date)}>
                    {renderCellContent(date, true)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 범례 */}
          <div className="mt-4 flex items-center gap-4 px-1">
            <span className="text-xs text-gray-400">우선순위</span>
            {(['urgent','high','normal','low'] as const).map(k => (
              <span key={k} className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className={`w-2 h-2 rounded-full ${PRIORITY_DOT[k]}`} />
                {PRIORITY_LABEL[k]}
              </span>
            ))}
          </div>

          {/* 마감일 없는 태스크 패널 */}
          {noDueTasks.length > 0 && (
            <div className="mt-4 bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <button onClick={() => setNoDueOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-700">마감일 없는 태스크</span>
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">{noDueTasks.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">날짜 셀로 드래그하여 마감일 설정</span>
                  <ChevronLeft size={14} className={`text-gray-400 transition-transform ${noDueOpen ? '-rotate-90' : 'rotate-90'}`} />
                </div>
              </button>
              {noDueOpen && (
                <div className="border-t border-gray-100 p-3 flex flex-wrap gap-2">
                  {noDueTasks.map(task => {
                    const proj = projectMap[task.project_id]
                    return (
                      <div key={task.id} draggable
                        onDragStart={() => setDraggingTask(task)}
                        onDragEnd={() => { setDraggingTask(null); setDragOverKey(null) }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-gray-50
                          hover:border-gray-300 hover:bg-white cursor-grab active:cursor-grabbing select-none transition-all
                          ${draggingTask?.id === task.id ? 'opacity-40' : ''}`}>
                        <span className={`w-2 h-2 rounded-full shrink-0 ${PRIORITY_DOT[task.priority]}`} />
                        <span className="text-xs text-gray-700 font-medium truncate max-w-[120px]">{task.title}</span>
                        {proj && (
                          <span className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: proj.color }} />
                            {proj.name}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 사이드 패널 */}
        {selectedDate && (
          <div className="w-72 shrink-0 border-l border-gray-200 bg-white flex flex-col">
            <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-gray-900">
                  {selectedDate.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {selectedHoliday && <span className="text-red-400 mr-1">🎌 {selectedHoliday}</span>}
                  일정 {selectedEvents.length}개 · 태스크 {selectedTasks.length}개
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => { setEditingEvent(undefined); setShowEventModal(true) }}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                  <Plus size={15} />
                </button>
                <button onClick={() => setSelectedDate(null)} className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors">
                  <X size={15} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-3 space-y-2">
              {!selectedHoliday && selectedEvents.length === 0 && selectedTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-gray-300">
                  <CalendarDays size={28} />
                  <p className="text-xs mt-2">이 날의 일정이 없습니다</p>
                </div>
              ) : (
                <>
                  {selectedHoliday && (
                    <div className="p-3 rounded-xl border border-red-100 bg-red-50 flex items-center gap-2">
                      <span className="text-base">🎌</span>
                      <p className="text-sm font-medium text-red-600">{selectedHoliday}</p>
                    </div>
                  )}
                  {selectedEvents.map(ev => (
                    <div key={ev.id}
                      className="p-3 rounded-xl border space-y-1.5 cursor-pointer hover:brightness-95 transition-all"
                      style={{ borderColor: ev.color + '40', backgroundColor: ev.color + '10' }}
                      onClick={() => { setEditingEvent(ev); setShowEventModal(true) }}>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ev.color }} />
                        <p className="text-sm font-medium text-gray-800 flex-1">{ev.title}</p>
                      </div>
                      {ev.end_date && ev.end_date !== ev.date && (
                        <p className="text-xs text-gray-400 pl-4">
                          {new Date(ev.date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} ~ {new Date(ev.end_date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                        </p>
                      )}
                      {ev.description && <p className="text-xs text-gray-500 pl-4 line-clamp-2">{ev.description}</p>}
                    </div>
                  ))}
                  {selectedTasks.map(task => (
                    <SidebarTaskCard key={task.id} task={task} proj={projectMap[task.project_id]} />
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
