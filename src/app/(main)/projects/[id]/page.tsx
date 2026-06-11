'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Task, TaskPriority, TaskType, ProjectColumn, ChecklistItem } from '@/types'
import { Plus, X, Archive, ArchiveRestore, ChevronDown, ChevronRight, Trash2, RotateCcw, GripVertical, CalendarDays, Maximize2, CheckSquare, Square, Users } from 'lucide-react'
import { use } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDroppable, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, horizontalListSortingStrategy, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const DEFAULT_COLS = [
  { name: '할 일',  color: '#f3f4f6', order: 0, _key: 'todo' },
  { name: '진행 중', color: '#eff6ff', order: 1, _key: 'in_progress' },
  { name: '완료',   color: '#f0fdf4', order: 2, _key: 'done' },
]

const COLUMN_COLORS = [
  '#f3f4f6', '#eff6ff', '#f0fdf4', '#fef3c7',
  '#fce7f3', '#ede9fe', '#fee2e2', '#e0f2fe',
]

const PRIORITY_META: Record<TaskPriority, { label: string; className: string }> = {
  low:    { label: '낮음', className: 'bg-gray-100 text-gray-500' },
  normal: { label: '보통', className: 'bg-blue-100 text-blue-600' },
  high:   { label: '높음', className: 'bg-orange-100 text-orange-600' },
  urgent: { label: '긴급', className: 'bg-red-100 text-red-600' },
}

// ───────── tag color helper ─────────
const TAG_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
  'bg-purple-100 text-purple-700',
  'bg-pink-100 text-pink-700',
  'bg-amber-100 text-amber-700',
  'bg-teal-100 text-teal-700',
  'bg-orange-100 text-orange-700',
  'bg-indigo-100 text-indigo-700',
]
function tagColor(tag: string) {
  let h = 0
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0
  return TAG_COLORS[h % TAG_COLORS.length]
}

// ───────── TaskModal ─────────
function TaskModal({ task, onClose, onUpdate }: {
  task: Task
  onClose: () => void
  onUpdate: (taskId: string, body: Partial<Task>) => void
}) {
  const [title, setTitle]       = useState(task.title)
  const [description, setDesc]  = useState(task.description)
  const [notes, setNotes]       = useState(task.notes)
  const [priority, setPriority] = useState<TaskPriority>(task.priority)
  const [taskType, setTaskType] = useState<TaskType>(task.task_type ?? 'task')
  const [dueDate, setDueDate]   = useState(task.due_date ? task.due_date.slice(0, 10) : '')
  const [tags, setTags]             = useState<string[]>(task.tags ?? [])
  const [tagInput, setTagInput]     = useState('')
  const [newItemText, setNewItemText] = useState('')
  const queryClient = useQueryClient()

  function addTag(raw: string) {
    const t = raw.trim().toLowerCase()
    if (t && !tags.includes(t)) setTags(prev => [...prev, t])
    setTagInput('')
  }
  function removeTag(t: string) { setTags(prev => prev.filter(x => x !== t)) }

  const { data: checklistItems = [] } = useQuery<ChecklistItem[]>({
    queryKey: ['checklist', task.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_items').select('*').eq('task_id', task.id).order('order')
      if (error) throw error
      return data
    },
  })

  const addItemMutation = useMutation({
    mutationFn: async (text: string) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('checklist_items').insert({
        task_id: task.id, user_id: user!.id, text, order: checklistItems.length,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist', task.id] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setNewItemText('')
    },
  })

  const toggleItemMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase.from('checklist_items').update({ completed }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist', task.id] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('checklist_items').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist', task.id] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  const completedCount = checklistItems.filter(i => i.completed).length

  function handleSave() {
    onUpdate(task.id, {
      title:       title.trim() || task.title,
      description: description,
      notes:       notes,
      priority:    priority,
      task_type:   taskType,
      due_date:    dueDate ? new Date(dueDate).toISOString() : null,
      tags,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={handleSave} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="text-base font-semibold flex-1 focus:outline-none bg-transparent border-b-2 border-transparent focus:border-gray-300 transition-colors pb-0.5"
            placeholder="태스크 이름"
          />
          <button onClick={handleSave} className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors ml-2">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          {/* 태스크 유형 */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTaskType('task')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all
                ${taskType === 'task' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}
            >
              <CalendarDays size={12} /> 태스크
            </button>
            <button
              onClick={() => setTaskType('meeting')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all
                ${taskType === 'meeting' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}
            >
              <Users size={12} /> 미팅 / 일정
            </button>
          </div>

          {/* 우선순위 + 날짜 */}
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-400">우선순위</p>
              <div className="flex gap-1.5">
                {(Object.keys(PRIORITY_META) as TaskPriority[]).map(p => (
                  <button key={p} onClick={() => setPriority(p)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border-2 ${PRIORITY_META[p].className} ${priority === p ? 'border-gray-400' : 'border-transparent'}`}>
                    {PRIORITY_META[p].label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-400">{taskType === 'meeting' ? '일정 날짜' : '마감일'}</p>
              <div className="flex items-center gap-1.5">
                <CalendarDays size={14} className="text-gray-400" />
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="text-sm text-gray-700 focus:outline-none border border-gray-200 rounded-lg px-2 py-1"
                />
                {dueDate && (
                  <button onClick={() => setDueDate('')} className="text-gray-300 hover:text-gray-500">
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 설명 */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-400">설명</p>
            <textarea
              value={description}
              onChange={e => setDesc(e.target.value)}
              placeholder="태스크에 대한 설명을 입력하세요..."
              rows={3}
              className="w-full text-sm text-gray-700 border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none"
            />
          </div>

          {/* 태그 */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-400">태그</p>
            <div className="flex flex-wrap gap-1.5 min-h-[28px]">
              {tags.map(t => (
                <span key={t} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${tagColor(t)}`}>
                  {t}
                  <button onClick={() => removeTag(t)} className="hover:opacity-60 transition-opacity">
                    <X size={10} />
                  </button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                    e.preventDefault()
                    addTag(tagInput)
                  }
                }}
                onBlur={() => { if (tagInput.trim()) addTag(tagInput) }}
                placeholder="태그 입력 후 Enter..."
                className="text-xs focus:outline-none text-gray-600 placeholder:text-gray-300 min-w-[120px] flex-1"
              />
            </div>
          </div>

          {/* 메모 */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-400">메모</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="개인 메모..."
              rows={3}
              className="w-full text-sm text-gray-700 border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none bg-gray-50"
            />
          </div>

          {/* 체크리스트 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-400">체크리스트</p>
              {checklistItems.length > 0 && (
                <span className="text-xs text-gray-400">{completedCount}/{checklistItems.length}</span>
              )}
            </div>

            {/* 진행률 바 */}
            {checklistItems.length > 0 && (
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-400 rounded-full transition-all"
                  style={{ width: `${(completedCount / checklistItems.length) * 100}%` }}
                />
              </div>
            )}

            {/* 아이템 목록 */}
            <div className="space-y-1">
              {checklistItems.map(item => (
                <div key={item.id} className="flex items-center gap-2 group/item">
                  <button onClick={() => toggleItemMutation.mutate({ id: item.id, completed: !item.completed })}
                    className="shrink-0 text-gray-400 hover:text-green-500 transition-colors">
                    {item.completed
                      ? <CheckSquare size={15} className="text-green-500" />
                      : <Square size={15} />}
                  </button>
                  <span className={`text-sm flex-1 ${item.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                    {item.text}
                  </span>
                  <button onClick={() => deleteItemMutation.mutate(item.id)}
                    className="opacity-0 group-hover/item:opacity-100 p-0.5 text-gray-300 hover:text-red-400 transition-all">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>

            {/* 새 아이템 추가 */}
            <div className="flex items-center gap-2">
              <Square size={15} className="text-gray-200 shrink-0" />
              <input
                value={newItemText}
                onChange={e => setNewItemText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newItemText.trim()) {
                    addItemMutation.mutate(newItemText.trim())
                  }
                }}
                placeholder="항목 추가... (Enter)"
                className="text-sm flex-1 focus:outline-none text-gray-600 placeholder:text-gray-300"
              />
              {newItemText.trim() && (
                <button onClick={() => addItemMutation.mutate(newItemText.trim())}
                  className="text-xs px-2 py-0.5 bg-gray-900 text-white rounded hover:bg-gray-700 transition-colors">
                  추가
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button onClick={handleSave}
            className="px-5 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors">
            저장
          </button>
        </div>
      </div>
    </div>
  )
}

// ───────── ColumnSettingsModal ─────────
function ColumnSettingsModal({ column, onClose, onSave }: {
  column: ProjectColumn
  onClose: () => void
  onSave: (name: string, limit: number | null) => void
}) {
  const [name, setName] = useState(column.name)
  const [wipValue, setWipValue] = useState(column.wip_limit?.toString() ?? '')

  function handleSave() {
    const trimmed = name.trim() || column.name
    const num = parseInt(wipValue)
    onSave(trimmed, isNaN(num) || num <= 0 ? null : num)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-80 p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900">컬럼 설정</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-500">컬럼 이름</label>
          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onClose() }}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-500">WIP 한도 <span className="text-gray-300 font-normal">(비우면 한도 없음)</span></label>
          <input
            type="number"
            min="1"
            value={wipValue}
            onChange={e => setWipValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onClose() }}
            placeholder="최대 태스크 수"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={handleSave} disabled={!name.trim()}
            className="flex-1 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors">
            저장
          </button>
          <button onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors">
            취소
          </button>
        </div>
      </div>
    </div>
  )
}

// ───────── due date helpers ─────────
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

const DUE_STATUS_META: Record<NonNullable<DueStatus>, { cardClass: string; badgeClass: string; label: string }> = {
  overdue:  { cardClass: 'border-red-300 bg-red-50',    badgeClass: 'text-red-500',    label: '기한 초과' },
  today:    { cardClass: 'border-orange-300 bg-orange-50', badgeClass: 'text-orange-500', label: '오늘 마감' },
  tomorrow: { cardClass: 'border-yellow-300 bg-yellow-50', badgeClass: 'text-yellow-600', label: '내일 마감' },
}

// ───────── TaskCard ─────────
function TaskCard({ task, columns, onSoftDelete, onMove, onArchive, onOpenModal, isDragOverlay = false }: {
  task: Task
  columns: ProjectColumn[]
  onSoftDelete: (id: string) => void
  onMove?: (task: Task, columnId: string) => void
  onArchive?: (id: string) => void
  onOpenModal?: (task: Task) => void
  isDragOverlay?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: isDragOverlay,
  })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }
  const isMeeting = task.task_type === 'meeting'
  const isDone = columns.some(c => c.id === task.status && c.name === '완료')
  const priority = PRIORITY_META[task.priority]
  const dueStatus = isMeeting || isDone ? null : getDueStatus(task.due_date)
  const dueMeta = dueStatus ? DUE_STATUS_META[dueStatus] : null

  return (
    <div
      ref={setNodeRef}
      style={isDragOverlay ? undefined : style}
      {...listeners} {...attributes}
      onDoubleClick={e => { e.stopPropagation(); onOpenModal?.(task) }}
      className={`rounded-lg p-3 shadow-sm border group cursor-grab active:cursor-grabbing ${
        isDragOverlay ? 'bg-white shadow-lg rotate-1 border-gray-100' :
        dueMeta ? `${dueMeta.cardClass}` : 'bg-white border-gray-100'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug">{task.title}</p>
        {!isDragOverlay && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0">
            <button onPointerDown={e => e.stopPropagation()} onClick={() => onOpenModal?.(task)}
              className="p-0.5 text-gray-300 hover:text-blue-500 transition-colors" title="열기">
              <Maximize2 size={13} />
            </button>
            <button onPointerDown={e => e.stopPropagation()} onClick={() => onArchive?.(task.id)}
              className="p-0.5 text-gray-300 hover:text-amber-500 transition-colors" title="보관">
              <Archive size={13} />
            </button>
            <button onPointerDown={e => e.stopPropagation()} onClick={() => onSoftDelete(task.id)}
              className="p-0.5 text-gray-300 hover:text-red-400 transition-colors" title="휴지통">
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {/* 우선순위 배지 + 날짜 */}
      {!isDragOverlay && (
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {isMeeting && (
            <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-600">
              <Users size={10} /> 미팅
            </span>
          )}
          {!isMeeting && task.priority !== 'normal' && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${priority.className}`}>
              {priority.label}
            </span>
          )}
          {task.due_date && (
            <span className={`flex items-center gap-0.5 text-xs font-medium ${dueMeta ? dueMeta.badgeClass : 'text-gray-400'}`}>
              <CalendarDays size={11} />
              {dueMeta ? dueMeta.label : new Date(task.due_date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
            </span>
          )}
          {task.checklist_items && task.checklist_items.length > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-gray-400">
              <CheckSquare size={11} />
              {task.checklist_items.filter(i => i.completed).length}/{task.checklist_items.length}
            </span>
          )}
        </div>
      )}

      {/* 태그 */}
      {!isDragOverlay && task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2 justify-end">
          {task.tags.slice(0, 3).map(t => (
            <span key={t} className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${tagColor(t)}`}>
              {t}
            </span>
          ))}
          {task.tags.length > 3 && (
            <span className="text-xs text-gray-400 self-center">+{task.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* 이동 버튼 */}
      {!isDragOverlay && onMove && (
        <div className="flex flex-wrap gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {columns.filter(c => c.id !== task.status).map(c => (
            <button key={c.id} onPointerDown={e => e.stopPropagation()} onClick={() => onMove(task, c.id)}
              className="text-xs px-2 py-0.5 bg-gray-100 hover:bg-gray-200 rounded transition-colors">
              → {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ───────── KanbanColumn ─────────
function KanbanColumn({ column, tasks, columns, onSoftDelete, onMove, onArchive, onDeleteColumn,
  onOpenModal, updateColumnMutation, collapsed, onToggleCollapse, addingTo, setAddingTo, newTitle, setNewTitle, onAddTask }: {
  column: ProjectColumn
  tasks: Task[]
  columns: ProjectColumn[]
  onSoftDelete: (id: string) => void
  onMove: (task: Task, columnId: string) => void
  onArchive: (id: string) => void
  onDeleteColumn: (col: ProjectColumn) => void
  onOpenModal: (task: Task) => void
  updateColumnMutation: { mutate: (args: { colId: string; body: Partial<ProjectColumn> }) => void }
  collapsed: boolean
  onToggleCollapse: () => void
  addingTo: string | null
  setAddingTo: (s: string | null) => void
  newTitle: string
  setNewTitle: (s: string) => void
  onAddTask: (columnId: string) => void
}) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: column.id })
  const { attributes, listeners, setNodeRef: setSortRef, transform, transition, isDragging: isColDragging } = useSortable({ id: `col:${column.id}` })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isColDragging ? 0.4 : 1 }
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const wipExceeded = column.wip_limit != null && tasks.length > column.wip_limit

  return (
    <div ref={setSortRef} style={style} className="w-72 shrink-0 flex flex-col">
      <div className="flex items-center justify-between mb-3 group/header">
        <div className="flex items-center gap-1.5">
          <button {...listeners} {...attributes}
            className="cursor-grab active:cursor-grabbing p-0.5 text-gray-300 hover:text-gray-500 transition-colors touch-none">
            <GripVertical size={14} />
          </button>
          <span
            className="text-sm font-semibold cursor-pointer hover:text-gray-600 transition-colors"
            onDoubleClick={() => setShowSettingsModal(true)}
            title="더블클릭하여 설정"
          >
            {column.name}
          </span>

          {/* 태스크 수 / WIP 배지 */}
          <button
            onClick={() => setShowSettingsModal(true)}
            title="클릭하여 컬럼 설정"
            className={`text-xs px-1.5 py-0.5 rounded-full transition-colors ${
              wipExceeded
                ? 'bg-red-100 text-red-600 font-semibold'
                : 'bg-white/60 text-gray-400 hover:bg-white hover:text-gray-600'
            }`}
          >
            {column.wip_limit != null ? `${tasks.length}/${column.wip_limit}` : tasks.length}
          </button>

          {showSettingsModal && (
            <ColumnSettingsModal
              column={column}
              onClose={() => setShowSettingsModal(false)}
              onSave={(name, limit) => updateColumnMutation.mutate({ colId: column.id, body: { name, wip_limit: limit } })}
            />
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={() => { setAddingTo(column.id); setNewTitle('') }}
            className="p-1 text-gray-400 hover:text-gray-700 transition-colors">
            <Plus size={16} />
          </button>
          <button onClick={onToggleCollapse}
            className="p-1 text-gray-400 hover:text-gray-700 transition-all" title={collapsed ? '펼치기' : '접기'}>
            {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
          <button onClick={() => onDeleteColumn(column)}
            className="p-1 text-gray-300 hover:text-red-400 opacity-0 group-hover/header:opacity-100 transition-all">
            <X size={14} />
          </button>
        </div>
      </div>

      {!collapsed && <div ref={setDropRef} style={{ backgroundColor: column.color }}
        className={`flex-1 rounded-xl p-2 space-y-2 min-h-32 transition-colors ${isOver ? 'ring-2 ring-gray-400 ring-offset-1' : ''}`}>
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <TaskCard key={task.id} task={task} columns={columns}
              onSoftDelete={onSoftDelete} onMove={onMove} onArchive={onArchive} onOpenModal={onOpenModal} />
          ))}
        </SortableContext>

        {addingTo === column.id && (
          <div className="bg-white rounded-lg p-3 border border-gray-200 space-y-2">
            <textarea autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onAddTask(column.id) }
                if (e.key === 'Escape') setAddingTo(null)
              }}
              placeholder="태스크 이름..." rows={2}
              className="w-full text-sm resize-none focus:outline-none" />
            <div className="flex gap-1.5">
              <button onClick={() => onAddTask(column.id)} disabled={!newTitle.trim()}
                className="px-3 py-1 bg-gray-900 text-white rounded text-xs font-medium disabled:opacity-50 hover:bg-gray-700 transition-colors">
                추가
              </button>
              <button onClick={() => setAddingTo(null)}
                className="px-3 py-1 border border-gray-200 rounded text-xs hover:bg-gray-50 transition-colors">
                취소
              </button>
            </div>
          </div>
        )}
      </div>}
    </div>
  )
}

// ───────── Page ─────────
export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const queryClient = useQueryClient()
  const [addingTo, setAddingTo]         = useState<string | null>(null)
  const [newTitle, setNewTitle]         = useState('')
  const [draggingTask, setDraggingTask] = useState<Task | null>(null)
  const [draggingColumn, setDraggingColumn] = useState<ProjectColumn | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [showTrash, setShowTrash]       = useState(false)
  const [addingColumn, setAddingColumn] = useState(false)
  const [newColName, setNewColName]     = useState('')
  const [newColColor, setNewColColor]   = useState(COLUMN_COLORS[0])
  const [filterPriority, setFilterPriority] = useState<TaskPriority | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedCols, setCollapsedCols] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(`collapsed-${id}`) ?? '[]')) }
    catch { return new Set() }
  })

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const { data: project } = useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').eq('id', id).single()
      if (error) throw error
      return data
    },
  })

  const { data: columns = [], isSuccess: colsReady } = useQuery<ProjectColumn[]>({
    queryKey: ['columns', id],
    queryFn: async () => {
      const { data } = await supabase.from('columns').select('*').eq('project_id', id).order('order')
      if (!data || data.length === 0) {
        const { data: { user } } = await supabase.auth.getUser()
        const { data: newCols } = await supabase.from('columns').insert(
          DEFAULT_COLS.map(c => ({ project_id: id, user_id: user!.id, name: c.name, color: c.color, order: c.order }))
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
    setCollapsedCols(prev => {
      const next = new Set(prev)
      columns.forEach(c => { if (c.name === '완료' && !next.has(c.id)) next.add(c.id) })
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

  const q = searchQuery.trim().toLowerCase()
  const activeTasks   = allTasks.filter(t =>
    !t.archived && !t.deleted_at &&
    (!filterPriority || t.priority === filterPriority) &&
    (!q || t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q))
  )
  const archivedTasks = allTasks.filter(t => t.archived && !t.deleted_at)
  const trashedTasks  = allTasks.filter(t => !!t.deleted_at)

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

  const createTaskMutation = useMutation({
    mutationFn: async (body: Partial<Task>) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('tasks').insert({ ...body, user_id: user!.id })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', id] })
      setNewTitle('')
      setAddingTo(null)
    },
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
      await Promise.all(newOrder.map((col, i) =>
        supabase.from('columns').update({ order: i }).eq('id', col.id)
      ))
    },
    onMutate: async (newOrder) => {
      await queryClient.cancelQueries({ queryKey: ['columns', id] })
      queryClient.setQueryData(['columns', id], newOrder)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['columns', id] }),
  })

  const createColumnMutation = useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('columns').insert({
        project_id: id, user_id: user!.id, name, color, order: columns.length,
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
      await Promise.all(tasks.map((t, i) =>
        supabase.from('tasks').update({ order: i }).eq('id', t.id)
      ))
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', id] }),
  })

  function handleDeleteColumn(col: ProjectColumn) {
    const colTasks = activeTasks.filter(t => t.status === col.id)
    if (colTasks.length > 0) {
      alert(`"${col.name}" 컬럼에 태스크가 ${colTasks.length}개 있습니다.\n태스크를 먼저 이동하거나 삭제해주세요.`)
      return
    }
    if (confirm(`"${col.name}" 컬럼을 삭제하시겠어요?`)) deleteColumnMutation.mutate(col.id)
  }

  function handleDragCancel() {
    setDraggingTask(null)
    setDraggingColumn(null)
  }

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

    // 컬럼 순서 변경
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
        // 같은 컬럼 내 순서 변경
        const colTasks = activeTasks
          .filter(t => t.status === activeTask.status)
          .sort((a, b) => a.order - b.order)
        const oldIdx = colTasks.findIndex(t => t.id === activeTask.id)
        const newIdx = colTasks.findIndex(t => t.id === overTask.id)
        if (oldIdx !== newIdx) reorderTasksMutation.mutate(arrayMove(colTasks, oldIdx, newIdx))
      } else {
        // 다른 컬럼으로 이동
        updateTaskMutation.mutate({ taskId: activeTask.id, body: { status: overTask.status } })
      }
    } else if (activeTask.status !== overId) {
      // 빈 컬럼 영역에 드롭
      updateTaskMutation.mutate({ taskId: activeTask.id, body: { status: overId } })
    }
  }

  function handleAddTask(columnId: string) {
    if (!newTitle.trim()) return
    createTaskMutation.mutate({
      title: newTitle.trim(), status: columnId,
      project_id: id, priority: 'normal', task_type: 'task', tags: [], notes: '', order: activeTasks.length,
    })
  }

  return (
    <>
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={(taskId, body) => updateTaskMutation.mutate({ taskId, body })}
        />
      )}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
        <div className="flex flex-col h-full">
          {/* 헤더 */}
          <div className="px-8 py-5 border-b border-gray-200 bg-white flex items-center gap-3 flex-wrap">
            {project && <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: project.color }} />}
            <h1 className="text-lg font-bold truncate">{project?.name ?? '...'}</h1>
            <span className="text-sm text-gray-400">
              {activeTasks.length}개 태스크{filterPriority ? ` (필터: ${PRIORITY_META[filterPriority].label})` : ''}
            </span>
            <div className="ml-auto flex items-center gap-3">
              {/* 검색 */}
              <div className="relative">
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="태스크 검색..."
                  className="w-44 pl-3 pr-7 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-gray-50"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* 우선순위 필터 */}
              <div className="flex items-center gap-1.5">
              {(['urgent', 'high', 'normal', 'low'] as TaskPriority[]).map(p => (
                <button
                  key={p}
                  onClick={() => setFilterPriority(prev => prev === p ? null : p)}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-all ${
                    filterPriority === p
                      ? PRIORITY_META[p].className + ' border-transparent ring-2 ring-offset-1 ring-gray-400'
                      : 'bg-white border-gray-200 text-gray-500 hover:border-gray-400'
                  }`}
                >
                  {PRIORITY_META[p].label}
                </button>
              ))}
              {filterPriority && (
                <button onClick={() => setFilterPriority(null)}
                  className="text-xs px-2 py-1 rounded-full text-gray-400 hover:text-gray-700 transition-colors">
                  초기화
                </button>
              )}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-8 space-y-8">
            {/* 칸반 보드 */}
            <div className="flex gap-4 items-start">
              <SortableContext items={columns.map(c => `col:${c.id}`)} strategy={horizontalListSortingStrategy}>
                {columns.map(col => (
                  <KanbanColumn key={col.id} column={col}
                    tasks={activeTasks.filter(t => t.status === col.id)}
                    columns={columns}
                    onSoftDelete={taskId => updateTaskMutation.mutate({ taskId, body: { deleted_at: new Date().toISOString() } })}
                    onMove={(task, columnId) => updateTaskMutation.mutate({ taskId: task.id, body: { status: columnId } })}
                    onArchive={taskId => updateTaskMutation.mutate({ taskId, body: { archived: true } })}
                    onDeleteColumn={handleDeleteColumn}
                    onOpenModal={setSelectedTask}
                    updateColumnMutation={updateColumnMutation}
                    collapsed={collapsedCols.has(col.id)}
                    onToggleCollapse={() => toggleCollapse(col.id)}
                    addingTo={addingTo} setAddingTo={setAddingTo}
                    newTitle={newTitle} setNewTitle={setNewTitle}
                    onAddTask={handleAddTask}
                  />
                ))}
              </SortableContext>

              {addingColumn ? (
                <div className="w-72 shrink-0 p-4 border-2 border-dashed border-gray-200 rounded-xl space-y-3 bg-white">
                  <p className="text-sm font-semibold text-gray-700">새 컬럼</p>
                  <input autoFocus value={newColName} onChange={e => setNewColName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newColName.trim()) createColumnMutation.mutate({ name: newColName, color: newColColor })
                      if (e.key === 'Escape') setAddingColumn(false)
                    }}
                    placeholder="컬럼 이름"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
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
                      className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-medium disabled:opacity-50 hover:bg-gray-700 transition-colors">
                      추가
                    </button>
                    <button onClick={() => setAddingColumn(false)}
                      className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs hover:bg-gray-50 transition-colors">
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAddingColumn(true)}
                  className="w-72 shrink-0 h-12 flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors">
                  <Plus size={16} /> 컬럼 추가
                </button>
              )}
            </div>

            {/* 보관된 태스크 */}
            {archivedTasks.length > 0 && (
              <div>
                <button onClick={() => setShowArchived(v => !v)}
                  className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-3">
                  {showArchived ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  <Archive size={14} /> 보관된 태스크 ({archivedTasks.length})
                </button>
                {showArchived && (
                  <div className="space-y-2 max-w-72">
                    {archivedTasks.map(task => (
                      <div key={task.id} className="bg-white rounded-lg p-3 border border-gray-200 group flex items-center justify-between gap-2 opacity-60">
                        <p className="text-sm text-gray-500 line-through truncate">{task.title}</p>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                          <button onClick={() => updateTaskMutation.mutate({ taskId: task.id, body: { archived: false } })}
                            className="p-0.5 text-gray-400 hover:text-green-500 transition-colors" title="복원">
                            <ArchiveRestore size={13} />
                          </button>
                          <button onClick={() => updateTaskMutation.mutate({ taskId: task.id, body: { deleted_at: new Date().toISOString() } })}
                            className="p-0.5 text-gray-400 hover:text-red-400 transition-colors" title="휴지통으로">
                            <Trash2 size={13} />
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
                  className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors mb-3">
                  {showTrash ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  <Trash2 size={14} /> 휴지통 ({trashedTasks.length})
                </button>
                {showTrash && (
                  <div className="space-y-2 max-w-72">
                    {trashedTasks.map(task => (
                      <div key={task.id} className="bg-white rounded-lg p-3 border border-gray-200 group flex items-center justify-between gap-2 opacity-50">
                        <p className="text-sm text-gray-400 line-through truncate">{task.title}</p>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                          <button onClick={() => updateTaskMutation.mutate({ taskId: task.id, body: { deleted_at: null } })}
                            className="p-0.5 text-gray-400 hover:text-green-500 transition-colors" title="복원">
                            <RotateCcw size={13} />
                          </button>
                          <button onClick={() => { if (confirm('영구 삭제하시겠어요?')) hardDeleteMutation.mutate(task.id) }}
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
