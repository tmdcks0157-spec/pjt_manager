'use client'

import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Project, ProjectColumn, TaskPriority, TaskType } from '@/types'
import { X, CalendarDays, Users, Plus, Square, CheckSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PRIORITY_META } from '@/lib/constants'

function tagColor(tag: string): string {
  const colors = [
    'bg-blue-100 text-blue-700', 'bg-green-100 text-green-700',
    'bg-purple-100 text-purple-700', 'bg-orange-100 text-orange-700',
    'bg-pink-100 text-pink-700', 'bg-indigo-100 text-indigo-700',
  ]
  let h = 0
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) % colors.length
  return colors[h]
}

interface Props {
  projects: Project[]
  columns: ProjectColumn[]
  defaultProjectId?: string
  onClose: () => void
  onSuccess?: () => void
}

export default function CreateTaskModal({ projects, columns, defaultProjectId, onClose, onSuccess }: Props) {
  const queryClient = useQueryClient()
  const [projectId, setProjectId] = useState(defaultProjectId ?? projects[0]?.id ?? '')
  const [title, setTitle]         = useState('')
  const [taskType, setTaskType]   = useState<TaskType>('task')
  const [priority, setPriority]   = useState<TaskPriority>('normal')
  const [dueDate, setDueDate]     = useState(new Date().toISOString().split('T')[0])
  const [description, setDesc]    = useState('')
  const [notes, setNotes]         = useState('')
  const [tags, setTags]               = useState<string[]>([])
  const [tagInput, setTagInput]       = useState('')
  const [checklistItems, setChecklistItems] = useState<string[]>([])
  const [newItemText, setNewItemText] = useState('')
  const titleRef    = useRef<HTMLInputElement>(null)
  const itemInputRef = useRef<HTMLInputElement>(null)

  function addChecklistItem() {
    const t = newItemText.trim()
    if (t) { setChecklistItems(p => [...p, t]); setNewItemText('') }
  }

  const firstCol = columns
    .filter(c => c.project_id === projectId && c.name !== '완료')
    .sort((a, b) => a.order - b.order)[0]

  function addTag(raw: string) {
    const t = raw.trim().toLowerCase()
    if (t && !tags.includes(t)) setTags(p => [...p, t])
    setTagInput('')
  }

  const mutation = useMutation({
    mutationFn: async () => {
      if (!title.trim() || !firstCol) throw new Error('필수 항목 누락')
      const { data: { user } } = await supabase.auth.getUser()

      // 1단계: 태스크 생성 (id 반환)
      const { data: task, error } = await supabase.from('tasks').insert({
        title: title.trim(),
        project_id: projectId,
        user_id: user!.id,
        status: firstCol.id,
        task_type: taskType,
        priority,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        description,
        notes,
        tags,
        archived: false,
        order: 0,
      }).select('id').single()
      if (error) throw error

      // 2단계: 체크리스트 항목 생성
      if (checklistItems.length > 0) {
        const { error: clError } = await supabase.from('checklist_items').insert(
          checklistItems.map((text, i) => ({
            task_id: task.id,
            user_id: user!.id,
            text,
            completed: false,
            order: i,
          }))
        )
        if (clError) throw clError
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today-tasks'] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      onSuccess?.()
      onClose()
    },
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[88vh]">

        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <input
            ref={titleRef}
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && title.trim()) mutation.mutate() }}
            className="text-base font-semibold flex-1 focus:outline-none bg-transparent border-b-2 border-transparent focus:border-gray-300 transition-colors pb-0.5"
            placeholder="태스크 이름"
          />
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors ml-2">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-5">

          {/* 프로젝트 */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-400">프로젝트</p>
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-300 bg-gray-50 w-full"
            >
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* 태스크 유형 */}
          <div className="flex items-center gap-2">
            <button onClick={() => setTaskType('task')}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all',
                taskType === 'task'
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400')}>
              <CalendarDays size={12} /> 태스크
            </button>
            <button onClick={() => setTaskType('meeting')}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all',
                taskType === 'meeting'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400')}>
              <Users size={12} /> 일정
            </button>
          </div>

          {/* 우선순위 + 날짜 */}
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-400">우선순위</p>
              <div className="flex gap-1.5">
                {(Object.keys(PRIORITY_META) as TaskPriority[]).map(p => (
                  <button key={p} onClick={() => setPriority(p)}
                    className={cn('px-2.5 py-1 rounded-full text-xs font-medium transition-all border-2',
                      PRIORITY_META[p].className,
                      priority === p ? 'border-gray-400' : 'border-transparent')}>
                    {PRIORITY_META[p].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-400">{taskType === 'meeting' ? '일정 날짜' : '마감일'}</p>
              <div className="flex items-center gap-1.5">
                <CalendarDays size={14} className="text-gray-400" />
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                  className="text-sm text-gray-700 focus:outline-none border border-gray-200 rounded-lg px-2 py-1" />
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
            <textarea value={description} onChange={e => setDesc(e.target.value)}
              placeholder="태스크에 대한 설명을 입력하세요..." rows={3}
              className="w-full text-sm text-gray-700 border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none" />
          </div>

          {/* 태그 */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-400">태그</p>
            <div className="flex flex-wrap gap-1.5 border border-gray-200 rounded-xl px-3 py-2 min-h-[36px]">
              {tags.map(t => (
                <span key={t} className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium', tagColor(t))}>
                  {t}
                  <button onClick={() => setTags(p => p.filter(x => x !== t))} className="hover:opacity-60">
                    <X size={10} />
                  </button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) { e.preventDefault(); addTag(tagInput) }
                }}
                onBlur={() => { if (tagInput.trim()) addTag(tagInput) }}
                placeholder={tags.length === 0 ? '태그 입력 후 Enter...' : ''}
                className="text-xs focus:outline-none text-gray-600 placeholder:text-gray-300 min-w-[120px] flex-1 bg-transparent"
              />
            </div>
          </div>

          {/* 체크리스트 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-400">체크리스트</p>
              {checklistItems.length > 0 && (
                <span className="text-xs text-gray-400">0 / {checklistItems.length}</span>
              )}
            </div>
            <div className="space-y-1">
              {checklistItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2 group/item">
                  <Square size={14} className="text-gray-300 shrink-0" />
                  <span className="flex-1 text-sm text-gray-700">{item}</span>
                  <button
                    onClick={() => setChecklistItems(p => p.filter((_, idx) => idx !== i))}
                    className="opacity-0 group-hover/item:opacity-100 text-gray-300 hover:text-red-400 transition-all"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <CheckSquare size={14} className="text-gray-300 shrink-0" />
              <input
                ref={itemInputRef}
                value={newItemText}
                onChange={e => setNewItemText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addChecklistItem() } }}
                placeholder="항목 추가..."
                className="flex-1 text-sm text-gray-700 focus:outline-none border-b border-gray-200 focus:border-gray-400 pb-0.5 transition-colors bg-transparent"
              />
              <button
                onClick={addChecklistItem}
                disabled={!newItemText.trim()}
                className="text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* 메모 */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-400">메모</p>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="개인 메모..." rows={2}
              className="w-full text-sm text-gray-700 border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-200 resize-none bg-gray-50" />
          </div>

          {!firstCol && projectId && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              선택한 프로젝트에 컬럼이 없습니다. 칸반보드에서 컬럼을 먼저 추가해주세요.
            </p>
          )}
        </div>

        {/* 하단 액션 */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <p className="text-xs text-gray-400">{title.trim() ? '' : '제목을 입력해주세요'}</p>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 transition-colors">
              취소
            </button>
            <button
              onClick={() => mutation.mutate()}
              disabled={!title.trim() || !firstCol || mutation.isPending}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-40 transition-colors"
            >
              <Plus size={14} />
              {mutation.isPending ? '추가 중...' : taskType === 'meeting' ? '일정 추가' : '태스크 추가'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
