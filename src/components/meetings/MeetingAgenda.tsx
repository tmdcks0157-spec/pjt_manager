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
    if (!text) { setAdding(false); return }
    await save([...meeting.agenda, newItem(text)])
    setNewText('')
    setAdding(false)
  }

  async function handleDelete(id: string) {
    await save(meeting.agenda.filter(i => i.id !== id))
  }

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3 shrink-0">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">안건</span>
        <button
          onClick={() => { setAdding(true); setTimeout(() => inputRef.current?.focus(), 50) }}
          className="ml-auto text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-0.5"
        >
          <Plus size={11} /> 추가
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {meeting.agenda.map(item => (
          <span
            key={item.id}
            className={cn(
              'group flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors cursor-pointer select-none',
              item.done
                ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-700 dark:text-green-400'
                : 'bg-white border-gray-200 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500'
            )}
            onClick={() => handleToggle(item.id)}
          >
            {item.done ? <CheckSquare size={10} /> : <Square size={10} />}
            <span className={item.done ? 'line-through' : ''}>{item.text}</span>
            <button
              onClick={e => { e.stopPropagation(); handleDelete(item.id) }}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-400 ml-0.5"
            >
              <X size={9} />
            </button>
          </span>
        ))}

        {adding && (
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
            className="px-2.5 py-1 rounded-full text-xs border border-blue-300 dark:border-blue-600
                       bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200
                       focus:outline-none focus:ring-1 focus:ring-blue-400 w-28"
          />
        )}
      </div>
    </div>
  )
}
