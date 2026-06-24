'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { requireUserId } from '@/lib/auth'
import type { Task, TaskPriority, TaskType, ChecklistItem } from '@/types'
import { useContacts } from '@/hooks/useCRM'
import ContactCombobox from '@/components/ui/ContactCombobox'
import { PRIORITY_META } from '@/lib/constants'
import { tagColor } from '@/lib/taskUtils'
import { X, CalendarDays, Users, CheckSquare, Square, ArchiveRestore, Archive } from 'lucide-react'

export default function TaskModal({ task, onClose, onUpdate, onRestore }: {
  task: Task
  onClose: () => void
  onUpdate?: (taskId: string, body: Partial<Task>) => void
  onRestore?: () => void
}) {
  const [title, setTitle]       = useState(task.title)
  const [description, setDesc]  = useState(task.description)
  const [notes, setNotes]       = useState(task.notes)
  const [priority, setPriority] = useState<TaskPriority>(task.priority)
  const [taskType, setTaskType] = useState<TaskType>(task.task_type ?? 'task')
  const [dueDate, setDueDate]   = useState(task.due_date ? task.due_date.slice(0, 10) : '')
  const [tags, setTags]             = useState<string[]>(task.tags ?? [])
  const [tagInput, setTagInput]     = useState('')
  const [contactId, setContactId]     = useState<string>(task.contact_id ?? '')
  const [assigneeName, setAssigneeName] = useState<string>(task.assignee_name ?? '')
  const [newItemText, setNewItemText] = useState('')
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingItemText, setEditingItemText] = useState('')
  const queryClient = useQueryClient()
  const { data: contacts = [] } = useContacts()

  const descRef  = useRef<HTMLTextAreaElement>(null)
  const notesRef = useRef<HTMLTextAreaElement>(null)

  const autoResize = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [])

  useEffect(() => {
    autoResize(descRef.current)
    autoResize(notesRef.current)
  }, [])

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
      const userId = await requireUserId()
      const { error } = await supabase.from('checklist_items').insert({
        task_id: task.id, user_id: userId, text, order: checklistItems.length,
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
    onUpdate?.(task.id, {
      title:       title.trim() || task.title,
      description, notes, priority, task_type: taskType,
      due_date:    dueDate ? new Date(dueDate).toISOString() : null,
      tags,
      contact_id:    contactId || null,
      assignee_name: contactId ? null : (assigneeName.trim() || null),
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={handleSave} />
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {task.archived && (
              <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 shrink-0">
                <Archive size={10} /> 보관됨
              </span>
            )}
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="text-base font-semibold flex-1 focus:outline-none bg-transparent dark:text-gray-100 border-b-2 border-transparent focus:border-gray-300 dark:focus:border-gray-500 transition-colors pb-0.5 min-w-0"
              placeholder="태스크 이름" maxLength={200}
            />
          </div>
          <button onClick={handleSave} className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors ml-2 shrink-0">
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
            <textarea ref={descRef} value={description}
              onChange={e => { setDesc(e.target.value); autoResize(e.target) }}
              placeholder="태스크에 대한 설명을 입력하세요..." rows={3} maxLength={5000}
              className="w-full text-sm text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 resize-none overflow-hidden" />
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
                placeholder="태그 입력 후 Enter..." maxLength={30}
                className="text-xs focus:outline-none text-gray-600 dark:text-gray-400 placeholder:text-gray-300 dark:placeholder:text-gray-600 min-w-[120px] flex-1" />
            </div>
          </div>

          {/* 담당자 */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500">담당자</p>
            <ContactCombobox
              contacts={contacts}
              contactId={contactId}
              assigneeName={assigneeName}
              onChange={(cid, name) => { setContactId(cid); setAssigneeName(name) }}
            />
          </div>

          {/* 메모 */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500">메모</p>
            <textarea ref={notesRef} value={notes}
              onChange={e => { setNotes(e.target.value); autoResize(e.target) }}
              placeholder="개인 메모..." rows={3} maxLength={5000}
              className="w-full text-sm text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 resize-none overflow-hidden bg-gray-50 dark:bg-gray-700" />
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
                placeholder="항목 추가... (Enter)" maxLength={200}
                className="text-sm flex-1 focus:outline-none text-gray-600 dark:text-gray-400 placeholder:text-gray-300 dark:placeholder:text-gray-600 bg-transparent" />
              {newItemText.trim() && (
                <button onClick={() => addItemMutation.mutate(newItemText.trim())}
                  className="text-xs px-2 py-0.5 bg-gray-900 text-white rounded hover:bg-gray-700 transition-colors">추가</button>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div>
            {onRestore && (
              <button onClick={() => { onRestore(); onClose() }}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors">
                <ArchiveRestore size={14} /> 복원
              </button>
            )}
          </div>
          <button onClick={handleSave}
            className="px-5 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors">저장</button>
        </div>
      </div>
    </div>
  )
}
