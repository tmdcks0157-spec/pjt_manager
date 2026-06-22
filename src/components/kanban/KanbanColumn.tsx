'use client'

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTheme } from '@/providers/ThemeProvider'
import type { Task, ProjectColumn, Project, Contact } from '@/types'
import { Plus, X, GripVertical, ChevronDown, ChevronRight } from 'lucide-react'
import TaskCard from './TaskCard'
import ColumnSettingsModal from './ColumnSettingsModal'

export default function KanbanColumn({ column, tasks, columns, projects, currentProjectId, onSoftDelete, onMove, onArchive,
  onDeleteColumn, onOpenModal, onCopy, onMoveToProject, updateColumnMutation,
  collapsed, onToggleCollapse, addingTo, setAddingTo, newTitle, setNewTitle, onAddTask,
  selectionMode, selectedIds, onToggleSelect, contactsMap }: {
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
  contactsMap: Record<string, Contact>
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
                onToggleSelect={onToggleSelect}
                contactsMap={contactsMap} />
            ))}
          </SortableContext>

          {addingTo === column.id && (
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-600 space-y-2">
              <textarea autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onAddTask(column.id) }
                  if (e.key === 'Escape') setAddingTo(null)
                }}
                placeholder="태스크 이름..." rows={2} maxLength={200}
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
