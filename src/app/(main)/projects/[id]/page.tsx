'use client'

import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { requireUserId } from '@/lib/auth'
import type { Task, TaskPriority, ProjectColumn, Project, Contact } from '@/types'
import { useContacts } from '@/hooks/useCRM'
import { PRIORITY_META } from '@/lib/constants'
import { tagColor } from '@/lib/taskUtils'
import {
  Plus, X, Archive, ArchiveRestore, ChevronDown, ChevronRight, Trash2, RotateCcw,
  GripVertical, CheckSquare, AlertCircle, Clock, Layers, Siren, TrendingUp, BookOpen, MessageSquare,
} from 'lucide-react'
import Link from 'next/link'
import { use } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ConfirmModal, { type ConfirmOptions } from '@/components/ui/ConfirmModal'
import TaskModal from '@/components/kanban/TaskModal'
import KanbanColumn from '@/components/kanban/KanbanColumn'
import TaskCard from '@/components/kanban/TaskCard'

const DEFAULT_COLS = [
  { name: '할 일',  color: '#f3f4f6', order: 0, _key: 'todo' },
  { name: '진행 중', color: '#eff6ff', order: 1, _key: 'in_progress' },
  { name: '완료',   color: '#f0fdf4', order: 2, _key: 'done' },
]

const COLUMN_COLORS = [
  '#f3f4f6', '#eff6ff', '#f0fdf4', '#fef3c7',
  '#fce7f3', '#ede9fe', '#fee2e2', '#e0f2fe',
]

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const queryClient = useQueryClient()
  const [addingTo, setAddingTo]             = useState<string | null>(null)
  const [newTitle, setNewTitle]             = useState('')
  const [draggingTask, setDraggingTask]     = useState<Task | null>(null)
  const [draggingColumn, setDraggingColumn] = useState<ProjectColumn | null>(null)
  const [selectedTask, setSelectedTask]     = useState<Task | null>(null)
  const [showArchived, setShowArchived]     = useState(false)
  const [showTrash, setShowTrash]           = useState(false)
  const [addingColumn, setAddingColumn]     = useState(false)
  const [newColName, setNewColName]         = useState('')
  const [newColColor, setNewColColor]       = useState(COLUMN_COLORS[0])
  const [filterPriority, setFilterPriority] = useState<TaskPriority | null>(null)
  const [filterTag, setFilterTag]           = useState<string | null>(null)
  const [sortByPriority, setSortByPriority] = useState(false)
  const [searchQuery, setSearchQuery]       = useState('')
  const [selectionMode, setSelectionMode]   = useState(false)
  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set())
  const [confirmOptions, setConfirmOptions] = useState<ConfirmOptions | null>(null)
  const [collapsedCols, setCollapsedCols]   = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(`collapsed-${id}`) ?? '[]')) }
    catch { return new Set() }
  })

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const { data: contacts = [] } = useContacts()
  const contactsMap = useMemo<Record<string, Contact>>(
    () => Object.fromEntries(contacts.map(c => [c.id, c])),
    [contacts]
  )

  const { data: project } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').eq('id', id).single()
      if (error) throw error
      return data
    },
  })

  const { data: allProjects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').order('created_at')
      if (error) throw error
      return data
    },
  })

  const { data: columns = [], isSuccess: colsReady } = useQuery<ProjectColumn[]>({
    queryKey: ['columns', id],
    queryFn: async () => {
      const { data } = await supabase.from('columns').select('*').eq('project_id', id).order('order')
      if (!data || data.length === 0) {
        const userId = await requireUserId()
        const { data: newCols } = await supabase.from('columns').insert(
          DEFAULT_COLS.map(c => ({ project_id: id, user_id: userId, name: c.name, color: c.color, order: c.order }))
        ).select()
        if (newCols) {
          for (let i = 0; i < DEFAULT_COLS.length; i++) {
            await supabase.from('tasks').update({ status: newCols[i].id })
              .eq('project_id', id).eq('status', DEFAULT_COLS[i]._key)
          }
        }
        return newCols ?? []
      }
      return data
    },
  })

  useEffect(() => {
    if (!colsReady || columns.length === 0) return
    if (localStorage.getItem(`collapsed-${id}`) !== null) return
    setCollapsedCols(prev => {
      const next = new Set(prev)
      columns.forEach(c => { if (c.name === '완료') next.add(c.id) })
      localStorage.setItem(`collapsed-${id}`, JSON.stringify([...next]))
      return next
    })
  }, [colsReady])

  function toggleCollapse(colId: string) {
    setCollapsedCols(prev => {
      const next = new Set(prev)
      next.has(colId) ? next.delete(colId) : next.add(colId)
      localStorage.setItem(`collapsed-${id}`, JSON.stringify([...next]))
      return next
    })
  }

  const { data: allTasks = [] } = useQuery<Task[]>({
    queryKey: ['tasks', id],
    enabled: colsReady,
    queryFn: async () => {
      const { data, error } = await supabase.from('tasks').select('*, checklist_items(*)').eq('project_id', id).order('order')
      if (error) throw error
      return data
    },
  })

  const PRIORITY_ORDER: Record<TaskPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 }
  const q = searchQuery.trim().toLowerCase()

  const allTags = useMemo(() => {
    const tags = new Set<string>()
    allTasks.filter(t => !t.archived && !t.deleted_at).forEach(t => t.tags?.forEach(tag => tags.add(tag)))
    return [...tags].sort()
  }, [allTasks])

  const activeTasks = (() => {
    const filtered = allTasks.filter(t =>
      !t.archived && !t.deleted_at &&
      (!filterPriority || t.priority === filterPriority) &&
      (!filterTag || t.tags?.includes(filterTag)) &&
      (!q || t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q))
    )
    if (!sortByPriority) return filtered
    return [...filtered].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
  })()
  const archivedTasks = allTasks.filter(t => t.archived && !t.deleted_at)
  const trashedTasks  = allTasks.filter(t => !!t.deleted_at)

  const summary = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const doneColIds = new Set(columns.filter(c => c.name === '완료').map(c => c.id))
    const base = allTasks.filter(t => !t.archived && !t.deleted_at)
    const total   = base.length
    const done    = base.filter(t => doneColIds.has(t.status)).length
    const overdue = base.filter(t => {
      if (!t.due_date || doneColIds.has(t.status) || t.task_type === 'meeting') return false
      const d = new Date(t.due_date); d.setHours(0,0,0,0)
      return d < today
    }).length
    const dueToday = base.filter(t => {
      if (!t.due_date || doneColIds.has(t.status) || t.task_type === 'meeting') return false
      const d = new Date(t.due_date); d.setHours(0,0,0,0)
      return d.getTime() === today.getTime()
    }).length
    const urgent = base.filter(t => t.priority === 'urgent' && !doneColIds.has(t.status)).length
    const high   = base.filter(t => t.priority === 'high'   && !doneColIds.has(t.status)).length
    return { total, done, overdue, dueToday, urgent, high }
  }, [allTasks, columns])

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, body }: { taskId: string; body: Partial<Task> }) => {
      const { error } = await supabase.from('tasks').update(body).eq('id', taskId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', id] }),
  })

  const hardDeleteMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', id] }),
  })

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ ids, body }: { ids: string[]; body: Partial<Task> }) => {
      const { error } = await supabase.from('tasks').update(body).in('id', ids)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', id] })
      setSelectedIds(new Set())
      setSelectionMode(false)
    },
  })

  function toggleSelect(taskId: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(taskId) ? next.delete(taskId) : next.add(taskId)
      return next
    })
  }

  function exitSelectionMode() {
    setSelectionMode(false)
    setSelectedIds(new Set())
  }

  const createTaskMutation = useMutation({
    mutationFn: async (body: Partial<Task>) => {
      const userId = await requireUserId()
      const { error } = await supabase.from('tasks').insert({ ...body, user_id: userId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', id] })
      setNewTitle(''); setAddingTo(null)
    },
  })

  const copyTaskMutation = useMutation({
    mutationFn: async (task: Task) => {
      const userId = await requireUserId()
      const { data: newTask, error } = await supabase.from('tasks').insert({
        title: `(복사) ${task.title}`,
        description: task.description,
        notes: task.notes,
        priority: task.priority,
        task_type: task.task_type,
        due_date: task.due_date,
        tags: task.tags,
        status: task.status,
        project_id: task.project_id,
        user_id: userId,
        order: activeTasks.length,
        archived: false,
      }).select().single()
      if (error) throw error
      const items = task.checklist_items ?? []
      if (items.length > 0 && newTask) {
        await supabase.from('checklist_items').insert(
          items.map((item, i) => ({
            task_id: newTask.id,
            user_id: userId,
            text: item.text,
            completed: false,
            order: i,
          }))
        )
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', id] }),
  })

  const moveToProjectMutation = useMutation({
    mutationFn: async ({ task, targetProjectId }: { task: Task; targetProjectId: string }) => {
      const { data: targetCols } = await supabase
        .from('columns').select('id').eq('project_id', targetProjectId).order('order').limit(1)
      const firstColId = targetCols?.[0]?.id
      if (!firstColId) throw new Error('대상 프로젝트에 컬럼이 없습니다')
      const { error } = await supabase.from('tasks').update({
        project_id: targetProjectId,
        status: firstColId,
      }).eq('id', task.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', id] }),
  })

  const updateColumnMutation = useMutation({
    mutationFn: async ({ colId, body }: { colId: string; body: Partial<ProjectColumn> }) => {
      const { error } = await supabase.from('columns').update(body).eq('id', colId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['columns', id] }),
  })

  const reorderColumnsMutation = useMutation({
    mutationFn: async (newOrder: ProjectColumn[]) => {
      await Promise.all(newOrder.map((col, i) => supabase.from('columns').update({ order: i }).eq('id', col.id)))
    },
    onMutate: async (newOrder) => {
      await queryClient.cancelQueries({ queryKey: ['columns', id] })
      queryClient.setQueryData(['columns', id], newOrder)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['columns', id] }),
  })

  const createColumnMutation = useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      const userId = await requireUserId()
      const { error } = await supabase.from('columns').insert({
        project_id: id, user_id: userId, name, color, order: columns.length,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['columns', id] })
      setAddingColumn(false); setNewColName(''); setNewColColor(COLUMN_COLORS[0])
    },
  })

  const deleteColumnMutation = useMutation({
    mutationFn: async (columnId: string) => {
      const { error } = await supabase.from('columns').delete().eq('id', columnId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['columns', id] }),
  })

  const reorderTasksMutation = useMutation({
    mutationFn: async (tasks: Task[]) => {
      await Promise.all(tasks.map((t, i) => supabase.from('tasks').update({ order: i }).eq('id', t.id)))
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', id] }),
  })

  function handleDeleteColumn(col: ProjectColumn) {
    const colTasks = activeTasks.filter(t => t.status === col.id)
    if (colTasks.length > 0) {
      setConfirmOptions({
        title: '컬럼 삭제 불가',
        message: `"${col.name}" 컬럼에 태스크가 ${colTasks.length}개 있습니다.\n태스크를 먼저 이동하거나 삭제해주세요.`,
        confirmText: '확인',
        hideCancel: true,
        onConfirm: () => {},
      })
      return
    }
    setConfirmOptions({
      title: '컬럼 삭제',
      message: `"${col.name}" 컬럼을 삭제하시겠어요?`,
      confirmText: '삭제',
      danger: true,
      onConfirm: () => deleteColumnMutation.mutate(col.id),
    })
  }

  function handleDragCancel() { setDraggingTask(null); setDraggingColumn(null) }

  function handleDragStart(event: DragStartEvent) {
    const activeId = event.active.id as string
    if (activeId.startsWith('col:')) {
      setDraggingColumn(columns.find(c => c.id === activeId.replace('col:', '')) ?? null)
      return
    }
    setDraggingTask(activeTasks.find(t => t.id === activeId) ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if ((active.id as string).startsWith('col:')) {
      setDraggingColumn(null)
      if (!over) return
      const fromId = (active.id as string).replace('col:', '')
      const toId   = (over.id   as string).replace('col:', '')
      const fi = columns.findIndex(c => c.id === fromId)
      const ti = columns.findIndex(c => c.id === toId)
      if (fi !== -1 && ti !== -1 && fi !== ti) reorderColumnsMutation.mutate(arrayMove(columns, fi, ti))
      return
    }
    setDraggingTask(null)
    if (!over) return
    const activeTask = activeTasks.find(t => t.id === active.id)
    if (!activeTask) return
    const overId = over.id as string
    const overTask = activeTasks.find(t => t.id === overId)
    if (overTask) {
      if (activeTask.status === overTask.status) {
        const colTasks = activeTasks.filter(t => t.status === activeTask.status).sort((a, b) => a.order - b.order)
        const oldIdx = colTasks.findIndex(t => t.id === activeTask.id)
        const newIdx = colTasks.findIndex(t => t.id === overTask.id)
        if (oldIdx !== newIdx) reorderTasksMutation.mutate(arrayMove(colTasks, oldIdx, newIdx))
      } else {
        updateTaskMutation.mutate({ taskId: activeTask.id, body: { status: overTask.status } })
      }
    } else if (activeTask.status !== overId) {
      updateTaskMutation.mutate({ taskId: activeTask.id, body: { status: overId } })
    }
  }

  function handleAddTask(columnId: string) {
    if (!newTitle.trim()) return
    createTaskMutation.mutate({
      title: newTitle.trim(), status: columnId,
      project_id: id, priority: 'normal', task_type: 'task', tags: [], notes: '', order: activeTasks.length, archived: false,
    })
  }

  return (
    <>
      {confirmOptions && (
        <ConfirmModal options={confirmOptions} onClose={() => setConfirmOptions(null)} />
      )}
      {selectedTask && (
        <TaskModal task={selectedTask} onClose={() => setSelectedTask(null)}
          onUpdate={(taskId, body) => updateTaskMutation.mutate({ taskId, body })} />
      )}

      {selectionMode && selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-gray-900 text-white px-4 py-3 rounded-2xl shadow-2xl">
          <span className="text-sm font-medium mr-2">{selectedIds.size}개 선택됨</span>
          <select
            onChange={e => {
              if (!e.target.value) return
              bulkUpdateMutation.mutate({ ids: [...selectedIds], body: { status: e.target.value } })
              e.target.value = ''
            }}
            defaultValue=""
            className="text-xs bg-white text-gray-900 rounded-lg px-2 py-1.5 font-medium cursor-pointer"
          >
            <option value="" disabled>컬럼 이동</option>
            {columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button
            onClick={() => bulkUpdateMutation.mutate({ ids: [...selectedIds], body: { archived: true } })}
            className="text-xs bg-white/10 hover:bg-white/20 rounded-lg px-3 py-1.5 font-medium transition-colors"
          >
            보관
          </button>
          <button
            onClick={() => setConfirmOptions({
              title: `${selectedIds.size}개 태스크 삭제`,
              message: '선택한 태스크를 휴지통으로 이동할까요?',
              confirmText: '이동',
              danger: true,
              onConfirm: () => bulkUpdateMutation.mutate({ ids: [...selectedIds], body: { deleted_at: new Date().toISOString() } }),
            })}
            className="text-xs bg-red-500 hover:bg-red-600 rounded-lg px-3 py-1.5 font-medium transition-colors"
          >
            삭제
          </button>
          <button onClick={exitSelectionMode} className="ml-1 text-gray-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>
      )}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
        <div className="flex flex-col h-full">
          {/* 헤더 */}
          <div className="px-8 py-5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center gap-3 flex-wrap">
            {project && <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: project.color }} />}
            <h1 className="text-lg font-bold truncate dark:text-gray-100">{project?.name ?? '...'}</h1>
            <Link
              href={`/projects/${id}/issues`}
              className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-400 transition-colors"
            >
              <BookOpen size={13} /> 이슈 & 기록
            </Link>
            <div className="ml-auto flex items-center gap-3">
              <div className="relative">
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="태스크 검색..."
                  className="w-44 pl-3 pr-7 py-1.5 text-sm border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-600 bg-gray-50 dark:bg-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <X size={13} />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {(['urgent', 'high', 'normal', 'low'] as TaskPriority[]).map(p => (
                  <button key={p} onClick={() => setFilterPriority(prev => prev === p ? null : p)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-all ${
                      filterPriority === p
                        ? PRIORITY_META[p].className + ' border-transparent ring-2 ring-offset-1 ring-gray-400'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400'
                    }`}>
                    {PRIORITY_META[p].label}
                  </button>
                ))}
                {filterPriority && (
                  <button onClick={() => setFilterPriority(null)}
                    className="text-xs px-2 py-1 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">초기화</button>
                )}
                <button
                  onClick={() => setSortByPriority(prev => !prev)}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-all ${
                    sortByPriority
                      ? 'bg-gray-900 text-white border-transparent'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400'
                  }`}
                  title="우선순위 높은 순으로 정렬"
                >
                  우선순위 정렬
                </button>
                <button
                  onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-all ${
                    selectionMode
                      ? 'bg-blue-600 text-white border-transparent'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400'
                  }`}
                >
                  {selectionMode ? '선택 취소' : '선택'}
                </button>
              </div>
            </div>
          </div>

          {/* 태그 필터 바 */}
          {allTags.length > 0 && (
            <div className="px-8 py-2 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">태그</span>
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setFilterTag(prev => prev === tag ? null : tag)}
                  className={`text-xs px-2 py-0.5 rounded-full font-medium transition-all border-2 ${tagColor(tag)} ${
                    filterTag === tag ? 'border-gray-500 ring-1 ring-gray-400' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                >
                  {tag}
                </button>
              ))}
              {filterTag && (
                <button
                  onClick={() => setFilterTag(null)}
                  className="text-xs px-2 py-0.5 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                  초기화
                </button>
              )}
            </div>
          )}

          {/* 요약 통계 바 */}
          {summary.total > 0 && (
            <div className="px-8 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex items-center gap-6 text-xs">
              <span className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                <Layers size={13} /> 전체 <strong className="text-gray-800 dark:text-gray-100">{summary.total}</strong>
              </span>
              <span className="flex items-center gap-1.5 text-green-600">
                <CheckSquare size={13} /> 완료 <strong>{summary.done}</strong>
              </span>
              {summary.dueToday > 0 && (
                <span className="flex items-center gap-1.5 text-orange-500">
                  <Clock size={13} /> 오늘 마감 <strong>{summary.dueToday}</strong>
                </span>
              )}
              {summary.overdue > 0 && (
                <span className="flex items-center gap-1.5 text-red-500">
                  <AlertCircle size={13} /> 기한 초과 <strong>{summary.overdue}</strong>
                </span>
              )}
              {summary.urgent > 0 && (
                <span className="flex items-center gap-1.5 text-red-600">
                  <Siren size={13} /> 긴급 <strong>{summary.urgent}</strong>
                </span>
              )}
              {summary.high > 0 && (
                <span className="flex items-center gap-1.5 text-orange-500">
                  <TrendingUp size={13} /> 높음 <strong>{summary.high}</strong>
                </span>
              )}
              {summary.total > 0 && (
                <span className="ml-auto text-gray-400 dark:text-gray-500">
                  진행률 <strong className="text-gray-700 dark:text-gray-300">{Math.round((summary.done / summary.total) * 100)}%</strong>
                </span>
              )}
            </div>
          )}

          <div className="flex-1 overflow-auto p-8 space-y-8">
            {/* 칸반 보드 */}
            <div className="flex gap-4 items-start">
              <SortableContext items={columns.map(c => `col:${c.id}`)} strategy={horizontalListSortingStrategy}>
                {columns.map(col => (
                  <KanbanColumn key={col.id} column={col}
                    tasks={activeTasks.filter(t => t.status === col.id)}
                    columns={columns}
                    projects={allProjects}
                    currentProjectId={id}
                    onSoftDelete={taskId => updateTaskMutation.mutate({ taskId, body: { deleted_at: new Date().toISOString() } })}
                    onMove={(task, columnId) => updateTaskMutation.mutate({ taskId: task.id, body: { status: columnId } })}
                    onArchive={taskId => updateTaskMutation.mutate({ taskId, body: { archived: true } })}
                    onDeleteColumn={handleDeleteColumn}
                    onOpenModal={setSelectedTask}
                    onCopy={task => copyTaskMutation.mutate(task)}
                    onMoveToProject={(task, targetProjectId) => moveToProjectMutation.mutate({ task, targetProjectId })}
                    updateColumnMutation={updateColumnMutation}
                    collapsed={collapsedCols.has(col.id)}
                    onToggleCollapse={() => toggleCollapse(col.id)}
                    addingTo={addingTo} setAddingTo={setAddingTo}
                    newTitle={newTitle} setNewTitle={setNewTitle}
                    onAddTask={handleAddTask}
                    selectionMode={selectionMode}
                    selectedIds={selectedIds}
                    onToggleSelect={toggleSelect}
                    contactsMap={contactsMap}
                  />
                ))}
              </SortableContext>

              {addingColumn ? (
                <div className="w-72 shrink-0 p-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl space-y-3 bg-white dark:bg-gray-800">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">새 컬럼</p>
                  <input autoFocus value={newColName} onChange={e => setNewColName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newColName.trim()) createColumnMutation.mutate({ name: newColName, color: newColColor })
                      if (e.key === 'Escape') setAddingColumn(false)
                    }}
                    placeholder="컬럼 이름"
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-gray-400" />
                  <div className="flex flex-wrap gap-2">
                    {COLUMN_COLORS.map(c => (
                      <button key={c} onClick={() => setNewColColor(c)}
                        className="w-6 h-6 rounded-md border-2 transition-all"
                        style={{ backgroundColor: c, borderColor: newColColor === c ? '#374151' : '#e5e7eb' }} />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => createColumnMutation.mutate({ name: newColName, color: newColColor })}
                      disabled={!newColName.trim()}
                      className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-medium disabled:opacity-50 hover:bg-gray-700 transition-colors">추가</button>
                    <button onClick={() => setAddingColumn(false)}
                      className="px-3 py-1.5 border border-gray-200 dark:border-gray-600 rounded-lg text-xs hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 transition-colors">취소</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAddingColumn(true)}
                  className="w-72 shrink-0 h-12 flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-400 dark:text-gray-500 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-colors">
                  <Plus size={16} /> 컬럼 추가
                </button>
              )}
            </div>

            {/* 보관된 태스크 */}
            {archivedTasks.length > 0 && (
              <div>
                <button onClick={() => setShowArchived(v => !v)}
                  className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors mb-3">
                  {showArchived ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  <Archive size={14} /> 보관된 태스크 ({archivedTasks.length})
                </button>
                {showArchived && (
                  <div className="grid grid-cols-2 gap-1.5">
                    {archivedTasks.map(task => (
                      <div key={task.id} className="bg-white dark:bg-gray-800 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-700 group flex items-center justify-between gap-2 opacity-60 hover:opacity-80 transition-opacity">
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-through truncate">{task.title}</p>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                          <button onClick={() => updateTaskMutation.mutate({ taskId: task.id, body: { archived: false } })}
                            className="p-0.5 text-gray-400 hover:text-green-500 transition-colors" title="복원">
                            <ArchiveRestore size={12} />
                          </button>
                          <button onClick={() => updateTaskMutation.mutate({ taskId: task.id, body: { deleted_at: new Date().toISOString() } })}
                            className="p-0.5 text-gray-400 hover:text-red-400 transition-colors" title="휴지통으로">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 휴지통 */}
            {trashedTasks.length > 0 && (
              <div>
                <button onClick={() => setShowTrash(v => !v)}
                  className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors mb-3">
                  {showTrash ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  <Trash2 size={14} /> 휴지통 ({trashedTasks.length})
                </button>
                {showTrash && (
                  <div className="grid grid-cols-2 gap-1.5">
                    {trashedTasks.map(task => (
                      <div key={task.id} className="bg-white dark:bg-gray-800 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-700 group flex items-center justify-between gap-2 opacity-50 hover:opacity-70 transition-opacity">
                        <p className="text-xs text-gray-400 dark:text-gray-500 line-through truncate">{task.title}</p>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                          <button onClick={() => updateTaskMutation.mutate({ taskId: task.id, body: { deleted_at: null } })}
                            className="p-0.5 text-gray-400 hover:text-green-500 transition-colors" title="복원">
                            <RotateCcw size={13} />
                          </button>
                          <button onClick={() => setConfirmOptions({
                              title: '태스크 영구 삭제',
                              message: `"${task.title}"\n영구 삭제하면 복구할 수 없습니다.`,
                              confirmText: '영구 삭제',
                              danger: true,
                              onConfirm: () => hardDeleteMutation.mutate(task.id),
                            })}
                            className="p-0.5 text-gray-400 hover:text-red-500 transition-colors" title="영구 삭제">
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DragOverlay>
          {draggingTask && <TaskCard task={draggingTask} columns={[]} onSoftDelete={() => {}} isDragOverlay />}
          {draggingColumn && (
            <div className="w-72 h-12 rounded-xl flex items-center px-4 gap-2 shadow-lg opacity-90"
              style={{ backgroundColor: draggingColumn.color }}>
              <GripVertical size={14} className="text-gray-400" />
              <span className="text-sm font-semibold">{draggingColumn.name}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </>
  )
}
