'use client'

import { useState, useEffect, useRef } from 'react'
import { X, CalendarDays, Square, CheckSquare, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PRIORITY_META } from '@/lib/constants'
import type { ActionItem, TaskPriority, ActionItemChecklist } from '@/types'

type SaveData = {
  text: string
  assignee: string
  dueDate: string
  priority: TaskPriority
  tags: string[]
  checklist: ActionItemChecklist[]
}

interface Props {
  initialData?: ActionItem
  onSave: (data: SaveData) => void
  onClose: () => void
}

const PRIORITIES: TaskPriority[] = ['low', 'normal', 'high', 'urgent']

export default function ActionItemModal({ initialData, onSave, onClose }: Props) {
  const [text, setText] = useState(initialData?.text ?? '')
  const [assignee, setAssignee] = useState(initialData?.assignee_name ?? '')
  const [dueDate, setDueDate] = useState(initialData?.due_date ?? '')
  const [priority, setPriority] = useState<TaskPriority>(initialData?.priority ?? 'normal')
  const [tags, setTags] = useState<string[]>(initialData?.tags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [checklist, setChecklist] = useState<ActionItemChecklist[]>(initialData?.checklist ?? [])
  const [checkInput, setCheckInput] = useState('')

  const titleRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { titleRef.current?.focus() }, [])
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  function addTag() {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t)) setTags(prev => [...prev, t])
    setTagInput('')
  }

  function addCheckItem() {
    const t = checkInput.trim()
    if (!t) return
    setChecklist(prev => [...prev, { id: crypto.randomUUID(), text: t, done: false }])
    setCheckInput('')
  }

  function toggleCheck(id: string) {
    setChecklist(prev => prev.map(c => c.id === id ? { ...c, done: !c.done } : c))
  }

  function removeCheck(id: string) {
    setChecklist(prev => prev.filter(c => c.id !== id))
  }

  function handleSubmit() {
    if (!text.trim()) return
    onSave({ text: text.trim(), assignee: assignee.trim(), dueDate, priority, tags, checklist })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[90vh]">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 pt-5 pb-1">
          <span className="text-xs font-medium text-gray-400">
            {initialData ? '액션 아이템 수정' : '액션 아이템 추가'}
          </span>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={16} />
          </button>
        </div>

        {/* 제목 */}
        <div className="flex items-start gap-3 px-6 pt-3 pb-2">
          <textarea
            ref={titleRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
            placeholder="액션 아이템 이름..."
            rows={1}
            className="flex-1 text-lg font-semibold resize-none focus:outline-none bg-transparent
                       text-gray-900 dark:text-gray-100 placeholder:text-gray-300
                       dark:placeholder:text-gray-600 leading-snug"
            style={{ overflow: 'hidden' }}
            onInput={e => {
              const el = e.currentTarget
              el.style.height = 'auto'
              el.style.height = el.scrollHeight + 'px'
            }}
          />
        </div>

        <div className="h-px bg-gray-100 dark:bg-gray-800 mx-6 mb-4" />

        <div className="overflow-y-auto px-6 pb-6 space-y-5">
          {/* 우선순위 + 마감일 */}
          <div className="flex items-start gap-6">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">우선순위</p>
              <div className="flex gap-1.5">
                {PRIORITIES.map(p => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={cn(
                      'px-3 py-1 rounded-full text-xs font-medium transition-all',
                      priority === p
                        ? PRIORITY_META[p].className + ' ring-2 ring-offset-1 ring-current'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                    )}
                  >
                    {PRIORITY_META[p].label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">마감일</p>
              <div className="flex items-center gap-1.5">
                <CalendarDays size={13} className="text-gray-400" />
                <input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="text-sm bg-transparent focus:outline-none text-gray-700 dark:text-gray-300"
                />
              </div>
            </div>
          </div>

          {/* 태그 */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">태그</p>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {tags.map(t => (
                <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded-full text-xs text-gray-600 dark:text-gray-300">
                  {t}
                  <button onClick={() => setTags(prev => prev.filter(x => x !== t))} className="text-gray-400 hover:text-red-400"><X size={10} /></button>
                </span>
              ))}
            </div>
            <input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
              placeholder="태그 입력 후 Enter..."
              className="text-sm bg-transparent focus:outline-none text-gray-700 dark:text-gray-300
                         placeholder:text-gray-400 dark:placeholder:text-gray-600 w-full"
            />
          </div>

          {/* 담당자 */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">담당자</p>
            <input
              value={assignee}
              onChange={e => setAssignee(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
              placeholder="담당자 검색 또는 직접 입력..."
              className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700
                         bg-gray-50 dark:bg-gray-800 focus:outline-none focus:border-gray-400
                         text-gray-700 dark:text-gray-300 placeholder:text-gray-400"
            />
          </div>

          {/* 체크리스트 */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">체크리스트</p>
            <div className="space-y-1">
              {checklist.map(c => (
                <div key={c.id} className="flex items-center gap-2 group">
                  <button onClick={() => toggleCheck(c.id)}>
                    {c.done
                      ? <CheckSquare size={14} className="text-green-500" />
                      : <Square size={14} className="text-gray-400" />}
                  </button>
                  <span className={cn('flex-1 text-sm', c.done && 'line-through text-gray-400')}>{c.text}</span>
                  <button onClick={() => removeCheck(c.id)} className="text-gray-300 hover:text-red-400">
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Plus size={13} className="text-gray-400 shrink-0" />
              <input
                value={checkInput}
                onChange={e => setCheckInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCheckItem() } }}
                placeholder="항목 추가... (Enter)"
                className="flex-1 text-sm bg-transparent focus:outline-none text-gray-700 dark:text-gray-300
                           placeholder:text-gray-400 dark:placeholder:text-gray-600"
              />
            </div>
          </div>
        </div>

        {/* 저장 */}
        <div className="flex justify-end px-6 py-4 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="px-5 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900
                       rounded-xl text-sm font-medium disabled:opacity-40
                       hover:bg-gray-700 dark:hover:bg-white transition-colors"
          >
            {initialData ? '수정' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
