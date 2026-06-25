'use client'

import { useState, useRef } from 'react'
import { CheckSquare, Square, ExternalLink, Check, X, Plus } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { requireUserId } from '@/lib/auth'
import { cn } from '@/lib/utils'
import type { ActionItem, Meeting } from '@/types'

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
  const [exportPickerId, setExportPickerId] = useState<string | null>(null)
  const [newText, setNewText] = useState('')
  const [newAssignee, setNewAssignee] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [showForm, setShowForm] = useState(false)

  async function handleToggle(item: ActionItem) {
    const next = item.status === 'open' ? 'done' : 'open'
    await supabase.from('action_items').update({ status: next }).eq('id', item.id)
    qc.invalidateQueries({ queryKey: ['meeting', meetingId] })
  }

  async function handleAdd() {
    const text = newText.trim()
    if (!text) return
    const userId = await requireUserId()
    await supabase.from('action_items').insert({
      meeting_id: meetingId,
      user_id: userId,
      text,
      assignee_name: newAssignee.trim() || null,
      due_date: newDueDate || null,
    })
    qc.invalidateQueries({ queryKey: ['meeting', meetingId] })
    setNewText('')
    setNewAssignee('')
    setNewDueDate('')
    setShowForm(false)
  }

  async function handleDelete(id: string) {
    await supabase.from('action_items').delete().eq('id', id)
    qc.invalidateQueries({ queryKey: ['meeting', meetingId] })
  }

  async function handleCarryover() {
    const userId = await requireUserId()
    const copies = pendingFromPrev.map(a => ({
      meeting_id: meetingId,
      user_id: userId,
      text: a.text,
      assignee_name: a.assignee_name,
      assignee_contact_id: a.assignee_contact_id,
      due_date: a.due_date,
      status: 'open' as const,
    }))
    await supabase.from('action_items').insert(copies)
    qc.invalidateQueries({ queryKey: ['meeting', meetingId] })
    setShowCarryover(false)
  }

  async function doExport(item: ActionItem, targetProjectId: string) {
    const userId = await requireUserId()
    const { data: cols } = await supabase
      .from('columns').select('id').eq('project_id', targetProjectId).order('order').limit(1)
    const columnId = cols?.[0]?.id
    if (!columnId) return

    const { data: task } = await supabase.from('tasks').insert({
      title: item.text,
      project_id: targetProjectId,
      user_id: userId,
      status: columnId,
      priority: 'normal',
      due_date: item.due_date ? new Date(item.due_date).toISOString() : null,
      assignee_name: item.assignee_name,
      description: '',
      notes: '',
      tags: [],
      order: 0,
      archived: false,
    }).select().single()

    if (task) {
      await supabase.from('action_items').update({ exported_task_id: task.id }).eq('id', item.id)
      qc.invalidateQueries({ queryKey: ['meeting', meetingId] })
    }
  }

  function handleExportClick(item: ActionItem) {
    if (meeting.project_id) {
      doExport(item, meeting.project_id)
    } else {
      setExportPickerId(item.id)
    }
  }

  const openItems = actionItems.filter(a => a.status === 'open')
  const doneItems = actionItems.filter(a => a.status === 'done')

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
        <button
          onClick={() => setShowForm(f => !f)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* 이전 회의 이월 배너 */}
        {showCarryover && pendingFromPrev.length > 0 && (
          <div className="mx-3 mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
              이전 회의 미완료 {pendingFromPrev.length}건
            </p>
            <div className="mt-1.5 space-y-0.5">
              {pendingFromPrev.slice(0, 3).map(a => (
                <p key={a.id} className="text-[11px] text-amber-600 dark:text-amber-500 truncate">
                  · {a.text}
                </p>
              ))}
              {pendingFromPrev.length > 3 && (
                <p className="text-[11px] text-amber-500">외 {pendingFromPrev.length - 3}건</p>
              )}
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={handleCarryover}
                className="px-2 py-1 bg-amber-600 text-white rounded text-[11px] hover:bg-amber-700"
              >
                이월하기
              </button>
              <button
                onClick={() => setShowCarryover(false)}
                className="text-[11px] text-amber-500 hover:text-amber-600"
              >
                무시
              </button>
            </div>
          </div>
        )}

        {/* 추가 폼 */}
        {showForm && (
          <div className="mx-3 mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
            <input
              autoFocus
              value={newText}
              onChange={e => setNewText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setShowForm(false) }}
              placeholder="액션 아이템..."
              className="w-full text-xs bg-transparent text-gray-700 dark:text-gray-300
                         placeholder:text-gray-300 dark:placeholder:text-gray-600
                         focus:outline-none mb-2"
            />
            <div className="flex gap-1.5">
              <input
                value={newAssignee}
                onChange={e => setNewAssignee(e.target.value)}
                placeholder="담당자"
                className="flex-1 text-[11px] px-2 py-1 rounded border border-gray-200 dark:border-gray-600
                           bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300
                           placeholder:text-gray-300 focus:outline-none"
              />
              <input
                type="date"
                value={newDueDate}
                onChange={e => setNewDueDate(e.target.value)}
                className="text-[11px] px-2 py-1 rounded border border-gray-200 dark:border-gray-600
                           bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300
                           focus:outline-none"
              />
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={handleAdd} className="px-2 py-1 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded text-[11px]">추가</button>
              <button onClick={() => setShowForm(false)} className="text-[11px] text-gray-400">취소</button>
            </div>
          </div>
        )}

        {/* 미완료 아이템 */}
        {openItems.length === 0 && !showForm && (
          <p className="text-[11px] text-gray-300 dark:text-gray-600 text-center mt-6">
            액션 아이템이 없습니다.
          </p>
        )}

        <div className="px-3 mt-3 space-y-0">
          {openItems.map(item => (
            <ActionItemRow
              key={item.id}
              item={item}
              exportPickerId={exportPickerId}
              projects={projects}
              onToggle={() => handleToggle(item)}
              onDelete={() => handleDelete(item.id)}
              onExportClick={() => handleExportClick(item)}
              onExportWithProject={(pid) => { setExportPickerId(null); doExport(item, pid) }}
              onClosePicker={() => setExportPickerId(null)}
            />
          ))}
        </div>

        {/* 완료 아이템 */}
        {doneItems.length > 0 && (
          <div className="px-3 mt-4">
            <p className="text-[10px] text-gray-400 font-medium mb-1.5">완료</p>
            <div className="space-y-0">
              {doneItems.map(item => (
                <ActionItemRow
                  key={item.id}
                  item={item}
                  exportPickerId={exportPickerId}
                  projects={projects}
                  onToggle={() => handleToggle(item)}
                  onDelete={() => handleDelete(item.id)}
                  onExportClick={() => handleExportClick(item)}
                  onExportWithProject={(pid) => { setExportPickerId(null); doExport(item, pid) }}
                  onClosePicker={() => setExportPickerId(null)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

interface RowProps {
  item: ActionItem
  exportPickerId: string | null
  projects: { id: string; name: string; color: string }[]
  onToggle: () => void
  onDelete: () => void
  onExportClick: () => void
  onExportWithProject: (projectId: string) => void
  onClosePicker: () => void
}

function ActionItemRow({ item, exportPickerId, projects, onToggle, onDelete, onExportClick, onExportWithProject, onClosePicker }: RowProps) {
  return (
    <div className="group flex items-start gap-2 py-2 border-b border-gray-100 dark:border-gray-800">
      <button onClick={onToggle} className="mt-0.5 shrink-0">
        {item.status === 'done'
          ? <CheckSquare size={13} className="text-green-500" />
          : <Square size={13} className="text-gray-400" />}
      </button>

      <div className="flex-1 min-w-0">
        <p className={cn('text-xs text-gray-700 dark:text-gray-300', item.status === 'done' && 'line-through text-gray-400 dark:text-gray-600')}>
          {item.text}
        </p>
        {(item.assignee_name || item.due_date) && (
          <p className="text-[10px] text-gray-400 mt-0.5">
            {[item.assignee_name, item.due_date].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!item.exported_task_id && (
          <div className="relative">
            <button onClick={onExportClick} title="태스크로 내보내기"
              className="text-gray-300 hover:text-blue-500 dark:text-gray-600 dark:hover:text-blue-400">
              <ExternalLink size={11} />
            </button>

            {exportPickerId === item.id && (
              <div className="absolute right-0 top-5 z-20 w-44 bg-white dark:bg-gray-800
                              border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1">
                <p className="px-3 py-1.5 text-[10px] text-gray-400 font-medium border-b border-gray-100 dark:border-gray-700">
                  프로젝트 선택
                </p>
                {projects.map(p => (
                  <button key={p.id} onMouseDown={() => onExportWithProject(p.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs
                               text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 text-left">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="truncate">{p.name}</span>
                  </button>
                ))}
                <button onMouseDown={onClosePicker}
                  className="w-full px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 text-left border-t border-gray-100 dark:border-gray-700">
                  취소
                </button>
              </div>
            )}
          </div>
        )}
        {item.exported_task_id && (
          <span title="태스크로 내보냄" className="text-green-400 dark:text-green-500">
            <Check size={11} />
          </span>
        )}
        <button onClick={onDelete} className="text-gray-300 hover:text-red-400 dark:text-gray-600 dark:hover:text-red-400">
          <X size={11} />
        </button>
      </div>
    </div>
  )
}
