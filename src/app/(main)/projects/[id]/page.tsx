'use client'

import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Task, TaskPriority, TaskType, ProjectColumn, ChecklistItem, Project } from '@/types'
import {
  Plus, X, Archive, ArchiveRestore, ChevronDown, ChevronRight, Trash2, RotateCcw,
  GripVertical, CalendarDays, Maximize2, CheckSquare, Square, Users,
  Copy, FolderInput, ChevronUp, AlertCircle, Clock, Layers, MoreHorizontal, Siren, TrendingUp, BookOpen,
} from 'lucide-react'
import Link from 'next/link'
import { use } from 'react'
import { useTheme } from '@/providers/ThemeProvider'
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

// ───────── ConfirmModal ─────────
interface ConfirmOptions {
  title: string
  message?: string
  confirmText?: string
  danger?: boolean
  hideCancel?: boolean
  onConfirm: () => void
}

function ConfirmModal({ options, onClose }: { options: ConfirmOptions; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-80 p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-sm font-bold leading-snug dark:text-gray-100">{options.title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0 mt-0.5"><X size={15} /></button>
        </div>
        {options.message && (
          <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed whitespace-pre-line">{options.message}</p>
        )}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => { options.onConfirm(); onClose() }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              options.danger ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-gray-900 text-white hover:bg-gray-700'
            }`}
          >
            {options.confirmText ?? '확인'}
          </button>
          {!options.hideCancel && (
            <button onClick={onClose} className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 transition-colors">
              취소
            </button>
          )}
        </div>
      </div>
    </div>
  )
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
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingItemText, setEditingItemText] = useState('')
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

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, text }: { id: string; text: string }) => {
      const { error } = await supabase.from('checklist_items').update({ text }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist', task.id] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
  })

  function commitItemEdit(id: string) {
    const text = editingItemText.trim()
    if (text) updateItemMutation.mutate({ id, text })
    setEditingItemId(null)
  }

  const completedCount = checklistItems.filter(i => i.completed).length

  function handleSave() {
    onUpdate(task.id, {
      title:       title.trim() || task.title,
      description, notes, priority, task_type: taskType,
      due_date:    dueDate ? new Date(dueDate).toISOString() : null,
      tags,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={handleSave} />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-700">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="text-base font-semibold flex-1 focus:outline-none bg-transparent dark:text-gray-100 border-b-2 border-transparent focus:border-gray-300 dark:focus:border-gray-500 transition-colors pb-0.5"
            placeholder="태스크 이름"
          />
          <button onClick={handleSave} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors ml-2">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">
          {/* 태스크 유형 */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTaskType('task')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all
                ${taskType === 'task' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-gray-400'}`}
            >
              <CalendarDays size={12} /> 태스크
            </button>
            <button
              onClick={() => setTaskType('meeting')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all
                ${taskType === 'meeting' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:border-gray-400'}`}
            >
              <Users size={12} /> 일정
            </button>
          </div>

          {/* 우선순위 + 날짜 */}
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-400 dark:text-gray-500">우선순위</p>
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
              <p className="text-xs font-medium text-gray-400 dark:text-gray-500">{taskType === 'meeting' ? '일정 날짜' : '마감일'}</p>
              <div className="flex items-center gap-1.5">
                <CalendarDays size={14} className="text-gray-400 dark:text-gray-500" />
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                  className="text-sm text-gray-700 dark:text-gray-200 focus:outline-none border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 bg-white dark:bg-gray-700" />
                {dueDate && (
                  <button onClick={() => setDueDate('')} className="text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400"><X size={13} /></button>
                )}
              </div>
            </div>
          </div>

          {/* 설명 */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500">설명</p>
            <textarea value={description} onChange={e => setDesc(e.target.value)}
              placeholder="태스크에 대한 설명을 입력하세요..." rows={3}
              className="w-full text-sm text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 resize-none" />
          </div>

          {/* 태그 */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500">태그</p>
            <div className="flex flex-wrap gap-1.5 min-h-[28px]">
              {tags.map(t => (
                <span key={t} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${tagColor(t)}`}>
                  {t}
                  <button onClick={() => removeTag(t)} className="hover:opacity-60"><X size={10} /></button>
                </span>
              ))}
              <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) { e.preventDefault(); addTag(tagInput) }
                }}
                onBlur={() => { if (tagInput.trim()) addTag(tagInput) }}
                placeholder="태그 입력 후 Enter..."
                className="text-xs focus:outline-none text-gray-600 dark:text-gray-400 placeholder:text-gray-300 dark:placeholder:text-gray-600 min-w-[120px] flex-1" />
            </div>
          </div>

          {/* 메모 */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500">메모</p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="개인 메모..." rows={3}
              className="w-full text-sm text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 resize-none bg-gray-50 dark:bg-gray-700" />
          </div>

          {/* 체크리스트 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-400 dark:text-gray-500">체크리스트</p>
              {checklistItems.length > 0 && <span className="text-xs text-gray-400 dark:text-gray-500">{completedCount}/{checklistItems.length}</span>}
            </div>
            {checklistItems.length > 0 && (
              <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-green-400 rounded-full transition-all"
                  style={{ width: `${(completedCount / checklistItems.length) * 100}%` }} />
              </div>
            )}
            <div className="space-y-1">
              {[...checklistItems].sort((a, b) => Number(a.completed) - Number(b.completed)).map(item => (
                <div key={item.id} className="flex items-center gap-2 group/item">
                  <button onClick={() => toggleItemMutation.mutate({ id: item.id, completed: !item.completed })}
                    className="shrink-0 text-gray-400 hover:text-green-500 transition-colors">
                    {item.completed ? <CheckSquare size={15} className="text-green-500" /> : <Square size={15} />}
                  </button>
                  {editingItemId === item.id ? (
                    <input
                      autoFocus
                      value={editingItemText}
                      onChange={e => setEditingItemText(e.target.value)}
                      onBlur={() => commitItemEdit(item.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') commitItemEdit(item.id)
                        if (e.key === 'Escape') setEditingItemId(null)
                      }}
                      className="text-sm flex-1 focus:outline-none border-b border-gray-300 dark:border-gray-600 bg-transparent dark:text-gray-200 pb-0.5"
                    />
                  ) : (
                    <span
                      onClick={() => { setEditingItemId(item.id); setEditingItemText(item.text) }}
                      className={`text-sm flex-1 cursor-text ${item.completed ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300'}`}
                    >
                      {item.text}
                    </span>
                  )}
                  <button onClick={() => deleteItemMutation.mutate(item.id)}
                    className="opacity-0 group-hover/item:opacity-100 p-0.5 text-gray-300 hover:text-red-400 transition-all shrink-0">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Square size={15} className="text-gray-200 shrink-0" />
              <input value={newItemText} onChange={e => setNewItemText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newItemText.trim()) addItemMutation.mutate(newItemText.trim()) }}
                placeholder="항목 추가... (Enter)"
                className="text-sm flex-1 focus:outline-none text-gray-600 dark:text-gray-400 placeholder:text-gray-300 dark:placeholder:text-gray-600 bg-transparent" />
              {newItemText.trim() && (
                <button onClick={() => addItemMutation.mutate(newItemText.trim())}
                  className="text-xs px-2 py-0.5 bg-gray-900 text-white rounded hover:bg-gray-700 transition-colors">추가</button>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex justify-end">
          <button onClick={handleSave}
            className="px-5 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors">저장</button>
        </div>
      </div>
    </div>
  )
}

// ───────── ColumnSettingsModal ─────────
function ColumnSettingsModal({ column, onClose, onSave }: {
  column: ProjectColumn; onClose: () => void; onSave: (name: string, limit: number | null) => void
}) {
  const [name, setName] = useState(column.name)
  const [wipValue, setWipValue] = useState(column.wip_limit?.toString() ?? '')

  function handleSave() {
    const num = parseInt(wipValue)
    onSave(name.trim() || column.name, isNaN(num) || num <= 0 ? null : num)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-80 p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">컬럼 설정</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X size={16} /></button>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">컬럼 이름</label>
          <input autoFocus value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onClose() }}
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-500" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-500 dark:text-gray-400">WIP 한도 <span className="text-gray-300 dark:text-gray-600 font-normal">(비우면 한도 없음)</span></label>
          <input type="number" min="1" value={wipValue} onChange={e => setWipValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onClose() }}
            placeholder="최대 태스크 수"
            className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-500" />
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={handleSave} disabled={!name.trim()}
            className="flex-1 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors">저장</button>
          <button onClick={onClose}
            className="px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 transition-colors">취소</button>
        </div>
      </div>
    </div>
  )
}

// ───────── MoveToProjectModal ─────────
function MoveToProjectModal({ task, projects, currentProjectId, onClose, onMove }: {
  task: Task
  projects: Project[]
  currentProjectId: string
  onClose: () => void
  onMove: (task: Task, targetProjectId: string) => void
}) {
  const others = projects.filter(p => p.id !== currentProjectId)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-80 p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold dark:text-gray-100">다른 프로젝트로 이동</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><X size={16} /></button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">"{task.title}"을(를) 이동할 프로젝트 선택</p>
        <div className="space-y-1.5 max-h-60 overflow-auto">
          {others.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">다른 프로젝트가 없습니다</p>
          ) : others.map(p => (
            <button key={p.id} onClick={() => { onMove(task, p.id); onClose() }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{p.name}</span>
            </button>
          ))}
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
  overdue:  { cardClass: 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20',             badgeClass: 'text-red-500',    label: '기한 초과' },
  today:    { cardClass: 'border-orange-300 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20', badgeClass: 'text-orange-500', label: '오늘 마감' },
  tomorrow: { cardClass: 'border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20', badgeClass: 'text-yellow-600', label: '내일 마감' },
}

// ───────── TaskActionModal ─────────
function TaskActionModal({ task, columns, onClose, onOpenModal, onMove, onCopy, onShowMoveProject, onArchive, onSoftDelete }: {
  task: Task
  columns: ProjectColumn[]
  onClose: () => void
  onOpenModal: () => void
  onMove: (columnId: string) => void
  onCopy: () => void
  onShowMoveProject: () => void
  onArchive: () => void
  onSoftDelete: () => void
}) {
  const otherCols = columns.filter(c => c.id !== task.status)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-72 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold truncate dark:text-gray-100">{task.title}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"><X size={15} /></button>
        </div>
        <div className="py-1.5">
          <button onClick={() => { onOpenModal(); onClose() }}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 transition-colors">
            <Maximize2 size={15} className="text-blue-400 shrink-0" /> 열기
          </button>
          {otherCols.length > 0 && (
            <>
              <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
              {otherCols.map(c => (
                <button key={c.id} onClick={() => { onMove(c.id); onClose() }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 transition-colors">
                  <ChevronRight size={15} className="text-gray-400 shrink-0" />
                  <span className="truncate">{c.name}으로 이동</span>
                </button>
              ))}
            </>
          )}
          <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
          <button onClick={() => { onCopy(); onClose() }}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 transition-colors">
            <Copy size={15} className="text-green-500 shrink-0" /> 복사
          </button>
          <button onClick={() => { onShowMoveProject(); onClose() }}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm text-gray-700 dark:text-gray-300 transition-colors">
            <FolderInput size={15} className="text-purple-500 shrink-0" /> 다른 프로젝트로 이동
          </button>
          <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
          <button onClick={() => { onArchive(); onClose() }}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-sm text-amber-600 transition-colors">
            <Archive size={15} className="shrink-0" /> 보관
          </button>
          <button onClick={() => { onSoftDelete(); onClose() }}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm text-red-500 transition-colors">
            <Trash2 size={15} className="shrink-0" /> 삭제
          </button>
        </div>
      </div>
    </div>
  )
}

// ───────── TaskCard ─────────
function TaskCard({ task, columns, projects, currentProjectId, onSoftDelete, onMove, onArchive,
  onOpenModal, onCopy, onMoveToProject, isDragOverlay = false,
  selectionMode = false, isSelected = false, onToggleSelect }: {
  task: Task
  columns: ProjectColumn[]
  projects?: Project[]
  currentProjectId?: string
  onSoftDelete: (id: string) => void
  onMove?: (task: Task, columnId: string) => void
  onArchive?: (id: string) => void
  onOpenModal?: (task: Task) => void
  onCopy?: (task: Task) => void
  onMoveToProject?: (task: Task, targetProjectId: string) => void
  isDragOverlay?: boolean
  selectionMode?: boolean
  isSelected?: boolean
  onToggleSelect?: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id, disabled: isDragOverlay,
  })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }

  const [expanded, setExpanded] = useState(() => {
    try {
      const stored: string[] = JSON.parse(localStorage.getItem(`collapsed-cards-${task.project_id}`) ?? '[]')
      return !stored.includes(task.id)
    } catch { return true }
  })
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [showActionModal, setShowActionModal] = useState(false)
  const queryClient = useQueryClient()

  const toggleChecklistMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase.from('checklist_items').update({ completed }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks', task.project_id] }),
  })

  function toggleExpanded() {
    setExpanded(v => {
      const next = !v
      try {
        const stored = new Set<string>(JSON.parse(localStorage.getItem(`collapsed-cards-${task.project_id}`) ?? '[]'))
        next ? stored.delete(task.id) : stored.add(task.id)
        localStorage.setItem(`collapsed-cards-${task.project_id}`, JSON.stringify([...stored]))
      } catch {}
      return next
    })
  }

  const isMeeting = task.task_type === 'meeting'
  const isDone = columns.some(c => c.id === task.status && c.name === '완료')
  const priority = PRIORITY_META[task.priority]
  const dueStatus = isMeeting || isDone ? null : getDueStatus(task.due_date)
  const dueMeta = dueStatus ? DUE_STATUS_META[dueStatus] : null

  const hasDescription = !!task.description?.trim()
  const checklist = task.checklist_items ?? []
  const completedCount = checklist.filter(i => i.completed).length
  const hasExpandable = hasDescription || checklist.length > 0

  return (
    <>
      {showMoveModal && projects && currentProjectId && onMoveToProject && (
        <MoveToProjectModal
          task={task}
          projects={projects}
          currentProjectId={currentProjectId}
          onClose={() => setShowMoveModal(false)}
          onMove={onMoveToProject}
        />
      )}
      {showActionModal && (
        <TaskActionModal
          task={task}
          columns={columns}
          onClose={() => setShowActionModal(false)}
          onOpenModal={() => onOpenModal?.(task)}
          onMove={colId => onMove?.(task, colId)}
          onCopy={() => onCopy?.(task)}
          onShowMoveProject={() => setShowMoveModal(true)}
          onArchive={() => onArchive?.(task.id)}
          onSoftDelete={() => onSoftDelete(task.id)}
        />
      )}
      <div
        ref={setNodeRef}
        style={isDragOverlay ? undefined : style}
        {...(selectionMode ? {} : { ...listeners, ...attributes })}
        onClick={selectionMode ? () => onToggleSelect?.(task.id) : undefined}
        onDoubleClick={selectionMode ? undefined : e => { e.stopPropagation(); onOpenModal?.(task) }}
        className={`relative rounded-lg p-3 shadow-sm border group transition-all ${
          selectionMode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
        } ${
          isSelected ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-200 dark:ring-blue-800' :
          isDragOverlay ? 'bg-white dark:bg-gray-800 shadow-lg rotate-1 border-gray-100 dark:border-gray-700' :
          dueMeta ? `${dueMeta.cardClass}` : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          {selectionMode && !isDragOverlay && (
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onToggleSelect?.(task.id) }}
              className="mt-0.5 shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors"
              style={{ borderColor: isSelected ? '#3b82f6' : '#d1d5db', backgroundColor: isSelected ? '#3b82f6' : 'white' }}
            >
              {isSelected && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
            </button>
          )}
          <p className="text-sm font-medium leading-snug flex-1 dark:text-gray-200">{task.title}</p>
          {!isDragOverlay && !selectionMode && (
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); setShowActionModal(true) }}
              className="p-0.5 text-gray-300 hover:text-gray-600 dark:text-gray-600 dark:hover:text-gray-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
              title="더 보기"
            >
              <MoreHorizontal size={15} />
            </button>
          )}
        </div>

        {/* 배지 행 */}
        {!isDragOverlay && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {isMeeting && (
              <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-600">
                <Users size={10} /> 일정
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
            {checklist.length > 0 && (
              <span className="flex items-center gap-0.5 text-xs text-gray-400">
                <CheckSquare size={11} />
                {completedCount}/{checklist.length}
              </span>
            )}
            {/* 펼치기 버튼 */}
            {hasExpandable && (
              <button
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); toggleExpanded() }}
                className="ml-auto text-gray-300 hover:text-gray-500 transition-colors"
                title={expanded ? '접기' : '내용 보기'}
              >
                {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            )}
          </div>
        )}

        {/* 펼쳐진 내용 — 설명 + 체크리스트 */}
        {!isDragOverlay && expanded && (
          <div className="mt-2 space-y-2 border-t border-gray-100 dark:border-gray-700 pt-2">
            {hasDescription && (
              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3 leading-relaxed whitespace-pre-line">{task.description}</p>
            )}
            {checklist.length > 0 && (
              <div className="space-y-1">
                <div className="w-full h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-green-400 rounded-full"
                    style={{ width: `${(completedCount / checklist.length) * 100}%` }} />
                </div>
                {[...checklist].sort((a, b) => Number(a.completed) - Number(b.completed)).slice(0, 4).map(item => (
                  <div key={item.id} className="flex items-center gap-1.5 text-xs">
                    <button
                      onPointerDown={e => e.stopPropagation()}
                      onClick={e => { e.stopPropagation(); toggleChecklistMutation.mutate({ id: item.id, completed: !item.completed }) }}
                      className="shrink-0 text-gray-400 hover:text-green-500 transition-colors"
                    >
                      {item.completed
                        ? <CheckSquare size={12} className="text-green-500" />
                        : <Square size={12} className="text-gray-300" />}
                    </button>
                    <span className={item.completed ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-400'}>{item.text}</span>
                  </div>
                ))}
                {checklist.length > 4 && (
                  <p className="text-xs text-gray-400 pl-4">+{checklist.length - 4}개 더</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* 태그 */}
        {!isDragOverlay && task.tags && task.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2 justify-end">
            {task.tags.slice(0, 3).map(t => (
              <span key={t} className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${tagColor(t)}`}>{t}</span>
            ))}
            {task.tags.length > 3 && <span className="text-xs text-gray-400 self-center">+{task.tags.length - 3}</span>}
          </div>
        )}

      </div>
    </>
  )
}

// ───────── KanbanColumn ─────────
function KanbanColumn({ column, tasks, columns, projects, currentProjectId, onSoftDelete, onMove, onArchive,
  onDeleteColumn, onOpenModal, onCopy, onMoveToProject, updateColumnMutation,
  collapsed, onToggleCollapse, addingTo, setAddingTo, newTitle, setNewTitle, onAddTask,
  selectionMode, selectedIds, onToggleSelect }: {
  column: ProjectColumn
  tasks: Task[]
  columns: ProjectColumn[]
  projects?: Project[]
  currentProjectId?: string
  onSoftDelete: (id: string) => void
  onMove: (task: Task, columnId: string) => void
  onArchive: (id: string) => void
  onDeleteColumn: (col: ProjectColumn) => void
  onOpenModal: (task: Task) => void
  onCopy: (task: Task) => void
  onMoveToProject: (task: Task, targetProjectId: string) => void
  updateColumnMutation: { mutate: (args: { colId: string; body: Partial<ProjectColumn> }) => void }
  collapsed: boolean
  onToggleCollapse: () => void
  addingTo: string | null
  setAddingTo: (s: string | null) => void
  newTitle: string
  setNewTitle: (s: string) => void
  onAddTask: (columnId: string) => void
  selectionMode: boolean
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
}) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: column.id })
  const { attributes, listeners, setNodeRef: setSortRef, transform, transition, isDragging: isColDragging } = useSortable({ id: `col:${column.id}` })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isColDragging ? 0.4 : 1 }
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const wipExceeded = column.wip_limit != null && tasks.length > column.wip_limit
  const { resolvedTheme } = useTheme()

  // collapsed 상태에서도 드롭 가능하도록 outer div에 sort+drop ref 통합
  function setOuterRef(el: HTMLDivElement | null) { setSortRef(el); setDropRef(el) }

  return (
    <div ref={setOuterRef} style={style} className="w-72 shrink-0 flex flex-col">
      <div className={`flex items-center justify-between mb-3 group/header rounded-xl px-1 transition-colors ${isOver && collapsed ? 'bg-gray-200/60 dark:bg-gray-600/40' : ''}`}>
        <div className="flex items-center gap-1.5">
          <button {...listeners} {...attributes}
            className="cursor-grab active:cursor-grabbing p-0.5 text-gray-300 hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400 transition-colors touch-none">
            <GripVertical size={14} />
          </button>
          <span className="text-sm font-semibold cursor-pointer hover:text-gray-600 dark:text-gray-200 dark:hover:text-gray-400 transition-colors"
            onDoubleClick={() => setShowSettingsModal(true)} title="더블클릭하여 설정">
            {column.name}
          </span>
          <button onClick={() => setShowSettingsModal(true)} title="컬럼 설정"
            className={`text-xs px-1.5 py-0.5 rounded-full transition-colors ${
              wipExceeded ? 'bg-red-100 text-red-600 font-semibold' : 'bg-white/60 dark:bg-gray-700/60 text-gray-400 dark:text-gray-500 hover:bg-white dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300'
            }`}>
            {column.wip_limit != null ? `${tasks.length}/${column.wip_limit}` : tasks.length}
          </button>
          {showSettingsModal && (
            <ColumnSettingsModal column={column} onClose={() => setShowSettingsModal(false)}
              onSave={(name, limit) => updateColumnMutation.mutate({ colId: column.id, body: { name, wip_limit: limit } })} />
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={() => { setAddingTo(column.id); setNewTitle('') }}
            className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"><Plus size={16} /></button>
          <button onClick={onToggleCollapse}
            className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-all" title={collapsed ? '펼치기' : '접기'}>
            {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
          </button>
          <button onClick={() => onDeleteColumn(column)}
            className="p-1 text-gray-300 hover:text-red-400 dark:text-gray-600 dark:hover:text-red-400 opacity-0 group-hover/header:opacity-100 transition-all">
            <X size={14} />
          </button>
        </div>
      </div>

      {!collapsed && (
        <div
          style={resolvedTheme === 'dark' ? undefined : { backgroundColor: column.color }}
          className={`flex-1 rounded-xl p-2 space-y-2 min-h-32 transition-colors dark:bg-gray-800/40 ${isOver ? 'ring-2 ring-gray-400 ring-offset-1' : ''}`}>
          <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
            {tasks.map(task => (
              <TaskCard key={task.id} task={task} columns={columns}
                projects={projects} currentProjectId={currentProjectId}
                onSoftDelete={onSoftDelete} onMove={onMove} onArchive={onArchive}
                onOpenModal={onOpenModal} onCopy={onCopy} onMoveToProject={onMoveToProject}
                selectionMode={selectionMode}
                isSelected={selectedIds.has(task.id)}
                onToggleSelect={onToggleSelect} />
            ))}
          </SortableContext>

          {addingTo === column.id && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-600 space-y-2">
              <textarea autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onAddTask(column.id) }
                  if (e.key === 'Escape') setAddingTo(null)
                }}
                placeholder="태스크 이름..." rows={2}
                className="w-full text-sm resize-none focus:outline-none bg-transparent dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500" />
              <div className="flex gap-1.5">
                <button onClick={() => onAddTask(column.id)} disabled={!newTitle.trim()}
                  className="px-3 py-1 bg-gray-900 text-white rounded text-xs font-medium disabled:opacity-50 hover:bg-gray-700 transition-colors">추가</button>
                <button onClick={() => setAddingTo(null)}
                  className="px-3 py-1 border border-gray-200 dark:border-gray-600 rounded text-xs hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 transition-colors">취소</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ───────── Page ─────────
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
    // 저장된 상태가 있으면 사용자 설정 유지 (첫 방문 시에만 완료 컬럼 자동 접기)
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

  // ── 칸반 요약 통계 ──
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
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('tasks').insert({ ...body, user_id: user!.id })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', id] })
      setNewTitle(''); setAddingTo(null)
    },
  })

  const copyTaskMutation = useMutation({
    mutationFn: async (task: Task) => {
      const { data: { user } } = await supabase.auth.getUser()
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
        user_id: user!.id,
        order: activeTasks.length,
        archived: false,
      }).select().single()
      if (error) throw error
      // 체크리스트 복사
      const items = task.checklist_items ?? []
      if (items.length > 0 && newTask) {
        await supabase.from('checklist_items').insert(
          items.map((item, i) => ({
            task_id: newTask.id,
            user_id: user!.id,
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

      {/* 일괄 선택 액션 바 */}
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
                  <div className="space-y-2 max-w-72">
                    {archivedTasks.map(task => (
                      <div key={task.id} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 group flex items-center justify-between gap-2 opacity-60">
                        <p className="text-sm text-gray-500 dark:text-gray-400 line-through truncate">{task.title}</p>
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
                  className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors mb-3">
                  {showTrash ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  <Trash2 size={14} /> 휴지통 ({trashedTasks.length})
                </button>
                {showTrash && (
                  <div className="space-y-2 max-w-72">
                    {trashedTasks.map(task => (
                      <div key={task.id} className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 group flex items-center justify-between gap-2 opacity-50">
                        <p className="text-sm text-gray-400 dark:text-gray-500 line-through truncate">{task.title}</p>
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
