'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Task, ProjectColumn, Project, Contact } from '@/types'
import { PRIORITY_META } from '@/lib/constants'
import { tagColor, getDueStatus, DUE_STATUS_META } from '@/lib/taskUtils'
import { CalendarDays, CheckSquare, Square, Users, ChevronUp, ChevronDown, MoreHorizontal } from 'lucide-react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import TaskActionModal from './TaskActionModal'
import MoveToProjectModal from './MoveToProjectModal'

export default function TaskCard({ task, columns, projects, currentProjectId, onSoftDelete, onMove, onArchive,
  onOpenModal, onCopy, onMoveToProject, isDragOverlay = false,
  selectionMode = false, isSelected = false, onToggleSelect, contactsMap = {} }: {
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
  contactsMap?: Record<string, Contact>
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
            {task.contact_id && contactsMap[task.contact_id] && (
              <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 font-medium">
                <Users size={9} />
                {contactsMap[task.contact_id].name}
              </span>
            )}
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
