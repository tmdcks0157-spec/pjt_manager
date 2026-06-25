'use client'

import { useState, useRef } from 'react'
import { CheckSquare, Square, X, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { Meeting, AgendaItem } from '@/types'

interface Props {
  meeting: Meeting
  onUpdate: (patch: Partial<Meeting>) => void
}

function newItem(text = ''): AgendaItem {
  return { id: crypto.randomUUID(), text, done: false }
}

export default function MeetingAgenda({ meeting, onUpdate }: Props) {
  const [adding, setAdding] = useState(false)
  const [newText, setNewText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function save(next: AgendaItem[]) {
    await supabase.from('meetings').update({ agenda: next }).eq('id', meeting.id)
    onUpdate({ agenda: next })
  }

  async function handleToggle(id: string) {
    const next = meeting.agenda.map(i => i.id === id ? { ...i, done: !i.done } : i)
    await save(next)
  }

  async function handleAdd() {
    const text = newText.trim()
    setAdding(false)
    setNewText('')
    if (!text) return
    await save([...meeting.agenda, newItem(text)])
  }

  async function handleDelete(id: string) {
    await save(meeting.agenda.filter(i => i.id !== id))
  }

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3 shrink-0">
      <div className="flex items-center mb-1.5">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">안건</span>
        <button
          onClick={() => { setAdding(true); setTimeout(() => inputRef.current?.focus(), 50) }}
          className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <Plus size={13} />
        </button>
      </div>

      <div className="space-y-0">
        {meeting.agenda.map((item, idx) => (
          <div
            key={item.id}
            className={cn(
              'group flex items-center gap-2.5 py-1.5',
              idx < meeting.agenda.length - 1 && 'border-b border-gray-50 dark:border-gray-800/60'
            )}
          >
            <button
              onClick={() => handleToggle(item.id)}
              className="shrink-0 mt-px"
            >
              {item.done
                ? <CheckSquare size={14} className="text-green-500" />
                : <Square size={14} className="text-gray-300 dark:text-gray-600 hover:text-gray-400" />}
            </button>
            <span
              className={cn(
                'flex-1 text-xs cursor-pointer select-none',
                item.done
                  ? 'line-through text-gray-400 dark:text-gray-600'
                  : 'text-gray-700 dark:text-gray-300'
              )}
              onClick={() => handleToggle(item.id)}
            >
              {item.text}
            </span>
            <button
              onClick={() => handleDelete(item.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-400 dark:text-gray-600 dark:hover:text-red-400"
            >
              <X size={11} />
            </button>
          </div>
        ))}

        {adding && (
          <div className="flex items-center gap-2.5 py-1.5">
            <Square size={14} className="text-gray-300 dark:text-gray-600 shrink-0" />
            <input
              ref={inputRef}
              value={newText}
              onChange={e => setNewText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAdd()
                if (e.key === 'Escape') { setAdding(false); setNewText('') }
              }}
              onBlur={handleAdd}
              placeholder="안건 입력..."
              className="flex-1 text-xs bg-transparent text-gray-700 dark:text-gray-300
                         placeholder:text-gray-300 dark:placeholder:text-gray-600
                         focus:outline-none border-b border-blue-300 dark:border-blue-600"
            />
          </div>
        )}

        {meeting.agenda.length === 0 && !adding && (
          <p className="text-[11px] text-gray-300 dark:text-gray-600 py-1">안건이 없습니다.</p>
        )}
      </div>
    </div>
  )
}
