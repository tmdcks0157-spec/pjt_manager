'use client'

import { useState } from 'react'
import { CheckSquare, Square, Check, X, Plus, Send } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { requireUserId } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { PRIORITY_META } from '@/lib/constants'
import type { ActionItem, Meeting, TaskPriority, ActionItemChecklist } from '@/types'
import ActionItemModal from './ActionItemModal'

interface Props {
  meetingId: string
  meeting: Meeting
  actionItems: ActionItem[]
  pendingFromPrev: ActionItem[]
  projects: { id: string; name: string; color: string }[]
}

export default function ActionItemPanel({ meetingId, meeting, actionItems, pendingFromPrev, projects }: Props) {
  const qc = useQueryClient()
  const [showCarryover, setShowCarryover] = useState(pendingFromPrev.length > 0)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<ActionItem | null>(null)
  // 내보내기 모드
  const [exportMode, setExportMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [exportProjectId, setExportProjectId] = useState(meeting.project_id ?? '')
  const [exporting, setExporting] = useState(false)

  async function handleToggle(item: ActionItem) {
    const next = item.status === 'open' ? 'done' : 'open'
    await supabase.from('action_items').update({ status: next }).eq('id', item.id)
    qc.invalidateQueries({ queryKey: ['meeting', meetingId] })
  }

  async function handleSave(data: {
    text: string; assignee: string; dueDate: string
    priority: TaskPriority; tags: string[]; checklist: ActionItemChecklist[]
  }) {
    if (editingItem) {
      await supabase.from('action_items').update({
        text: data.text,
        assignee_name: data.assignee || null,
        due_date: data.dueDate || null,
        priority: data.priority,
        tags: data.tags,
        checklist: data.checklist,
      }).eq('id', editingItem.id)
      setEditingItem(null)
    } else {
      const userId = await requireUserId()
      await supabase.from('action_items').insert({
        meeting_id: meetingId,
        user_id: userId,
        text: data.text,
        assignee_name: data.assignee || null,
        due_date: data.dueDate || null,
        priority: data.priority,
        tags: data.tags,
        checklist: data.checklist,
      })
    }
    qc.invalidateQueries({ queryKey: ['meeting', meetingId] })
  }

  async function handleDelete(id: string) {
    await supabase.from('action_items').delete().eq('id', id)
    qc.invalidateQueries({ queryKey: ['meeting', meetingId] })
  }

  async function handleCarryover() {
    const userId = await requireUserId()
    const copies = pendingFromPrev.map(a => ({
      meeting_id: meetingId, user_id: userId,
      text: a.text, assignee_name: a.assignee_name,
      assignee_contact_id: a.assignee_contact_id,
      due_date: a.due_date, status: 'open' as const,
    }))
    await supabase.from('action_items').insert(copies)
    qc.invalidateQueries({ queryKey: ['meeting', meetingId] })
    setShowCarryover(false)
  }

  // 선택한 액션아이템 → 칸반 태스크로 내보내기
  async function handleBulkExport() {
    if (!exportProjectId || selectedIds.size === 0) return
    setExporting(true)
    const userId = await requireUserId()
    const { data: cols } = await supabase
      .from('columns').select('id').eq('project_id', exportProjectId).order('order').limit(1)
    const columnId = cols?.[0]?.id
    if (!columnId) { setExporting(false); return }

    const targets = actionItems.filter(a => selectedIds.has(a.id))
    for (const item of targets) {
      const { data: task } = await supabase.from('tasks').insert({
        title: item.text,
        project_id: exportProjectId,
        user_id: userId,
        status: columnId,
        priority: item.priority ?? 'normal',
        due_date: item.due_date ? new Date(item.due_date).toISOString() : null,
        assignee_name: item.assignee_name,
        tags: item.tags ?? [],
        description: '', notes: '', order: 0, archived: false,
      }).select().single()
      if (task) {
        await supabase.from('action_items').update({ exported_task_id: task.id }).eq('id', item.id)
      }
    }
    qc.invalidateQueries({ queryKey: ['meeting', meetingId] })
    setExportMode(false)
    setSelectedIds(new Set())
    setExporting(false)
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function enterExportMode() {
    const preselect = new Set(actionItems.filter(a => !a.exported_task_id).map(a => a.id))
    setSelectedIds(preselect)
    setExportMode(true)
  }

  const openItems = actionItems.filter(a => a.status === 'open')
  const doneItems = actionItems.filter(a => a.status === 'done')
  const exportableCount = actionItems.filter(a => !a.exported_task_id).length

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
          액션 아이템
          {openItems.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full text-[10px]">
              {openItems.length}
            </span>
          )}
        </span>
        <div className="flex items-center gap-1">
          {!exportMode && exportableCount > 0 && (
            <button
              onClick={enterExportMode}
              title="칸반보드로 내보내기"
              className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-400 hover:text-blue-500
                         hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
            >
              <Send size={11} />
              내보내기
            </button>
          )}
          {!exportMode && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-400 hover:text-gray-600
                         dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              <Plus size={12} />
              추가
            </button>
          )}
          {exportMode && (
            <button
              onClick={() => { setExportMode(false); setSelectedIds(new Set()) }}
              className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
            >
              취소
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col">
        <div className="flex-1 px-3 pt-3 space-y-2">
          {/* 이전 회의 이월 배너 */}
          {showCarryover && pendingFromPrev.length > 0 && (
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                이전 회의 미완료 {pendingFromPrev.length}건
              </p>
              <div className="mt-1.5 space-y-0.5">
                {pendingFromPrev.slice(0, 3).map(a => (
                  <p key={a.id} className="text-[11px] text-amber-600 dark:text-amber-500 truncate">· {a.text}</p>
                ))}
                {pendingFromPrev.length > 3 && <p className="text-[11px] text-amber-500">외 {pendingFromPrev.length - 3}건</p>}
              </div>
              <div className="flex gap-2 mt-2">
                <button onClick={handleCarryover} className="px-2 py-1 bg-amber-600 text-white rounded text-[11px] hover:bg-amber-700">이월하기</button>
                <button onClick={() => setShowCarryover(false)} className="text-[11px] text-amber-500 hover:text-amber-600">무시</button>
              </div>
            </div>
          )}

          {/* 미완료 아이템 */}
          {openItems.length === 0 && (
            <p className="text-[11px] text-gray-300 dark:text-gray-600 text-center py-4">액션 아이템이 없습니다.</p>
          )}
          {openItems.map(item => (
            <ActionItemRow key={item.id} item={item}
              exportMode={exportMode} selected={selectedIds.has(item.id)}
              onToggleSelect={() => toggleSelect(item.id)}
              onToggle={() => handleToggle(item)}
              onDelete={() => handleDelete(item.id)}
              onEdit={() => setEditingItem(item)} />
          ))}

          {/* 완료 아이템 */}
          {doneItems.length > 0 && (
            <div className="pt-2">
              <p className="text-[10px] text-gray-400 font-medium mb-1.5">완료</p>
              <div className="space-y-2">
                {doneItems.map(item => (
                  <ActionItemRow key={item.id} item={item}
                    exportMode={exportMode} selected={selectedIds.has(item.id)}
                    onToggleSelect={() => toggleSelect(item.id)}
                    onToggle={() => handleToggle(item)}
                    onDelete={() => handleDelete(item.id)}
                    onEdit={() => setEditingItem(item)} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 내보내기 확인 패널 */}
        {exportMode && (
          <div className="px-3 pb-3 pt-2 shrink-0 border-t border-gray-100 dark:border-gray-800 space-y-2">
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {selectedIds.size}개 선택 → 칸반보드로 내보내기
            </p>
            <select
              value={exportProjectId}
              onChange={e => setExportProjectId(e.target.value)}
              className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700
                         bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none"
            >
              <option value="">프로젝트 선택...</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button
              onClick={handleBulkExport}
              disabled={!exportProjectId || selectedIds.size === 0 || exporting}
              className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium
                         disabled:opacity-40 transition-colors flex items-center justify-center gap-1.5"
            >
              <Send size={11} />
              {exporting ? '내보내는 중...' : `${selectedIds.size}개 내보내기`}
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <ActionItemModal onSave={handleSave} onClose={() => setShowModal(false)} />
      )}
      {editingItem && (
        <ActionItemModal
          initialData={editingItem}
          onSave={handleSave}
          onClose={() => setEditingItem(null)}
        />
      )}
    </div>
  )
}

interface RowProps {
  item: ActionItem
  exportMode: boolean
  selected: boolean
  onToggleSelect: () => void
  onToggle: () => void
  onDelete: () => void
  onEdit: () => void
}

function ActionItemRow({ item, exportMode, selected, onToggleSelect, onToggle, onDelete, onEdit }: RowProps) {
  const priority = PRIORITY_META[item.priority ?? 'normal']
  return (
    <div
      onClick={!exportMode ? onEdit : undefined}
      className={cn(
        'group flex items-start gap-2 p-2 rounded-lg border transition-colors',
        !exportMode && 'cursor-pointer',
        exportMode && selected
          ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20'
          : 'border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700'
      )}
    >
      {/* 내보내기 모드: 체크박스 / 일반 모드: 완료 토글 */}
      {exportMode ? (
        <button onClick={e => { e.stopPropagation(); onToggleSelect() }} className="mt-0.5 shrink-0">
          {selected
            ? <CheckSquare size={14} className="text-blue-500" />
            : <Square size={14} className="text-gray-300 dark:text-gray-600" />}
        </button>
      ) : (
        <button onClick={e => { e.stopPropagation(); onToggle() }} className="mt-0.5 shrink-0">
          {item.status === 'done'
            ? <CheckSquare size={14} className="text-green-500" />
            : <Square size={14} className="text-gray-400" />}
        </button>
      )}

      <div className="flex-1 min-w-0">
        <p className={cn('text-xs text-gray-700 dark:text-gray-300 leading-snug',
          item.status === 'done' && !exportMode && 'line-through text-gray-400 dark:text-gray-600')}>
          {item.text}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {item.priority && item.priority !== 'normal' && (
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', priority.className)}>
              {priority.label}
            </span>
          )}
          {item.assignee_name && <span className="text-[10px] text-gray-400">{item.assignee_name}</span>}
          {item.due_date && <span className="text-[10px] text-gray-400">{item.due_date}</span>}
          {item.exported_task_id && (
            <span className="text-[10px] text-green-500 flex items-center gap-0.5">
              <Check size={9} />칸반 등록
            </span>
          )}
        </div>
        {(item.tags ?? []).length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {item.tags.map(t => (
              <span key={t} className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full text-gray-500">{t}</span>
            ))}
          </div>
        )}
      </div>

      {!exportMode && (
        <button onClick={e => { e.stopPropagation(); onDelete() }}
          className="transition-opacity text-gray-300 hover:text-red-400 dark:text-gray-600 dark:hover:text-red-400 mt-0.5">
          <X size={11} />
        </button>
      )}
    </div>
  )
}
