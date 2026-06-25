'use client'

import { useState, useRef } from 'react'
import { X, UserPlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { requireUserId } from '@/lib/auth'
import { useContacts } from '@/hooks/useCRM'
import { useQueryClient } from '@tanstack/react-query'
import type { Meeting } from '@/types'

interface Props {
  meeting: Meeting
}

export default function MeetingAttendees({ meeting }: Props) {
  const qc = useQueryClient()
  const { data: contacts = [] } = useContacts()
  const [input, setInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const attendees = meeting.attendees ?? []

  const suggestions = input.trim()
    ? contacts.filter(c =>
        c.name.toLowerCase().includes(input.toLowerCase()) &&
        !attendees.some(a => a.contact_id === c.id)
      ).slice(0, 5)
    : []

  async function addAttendee(name: string, contactId: string | null = null, email: string | null = null) {
    await supabase.from('meeting_attendees').insert({
      meeting_id: meeting.id,
      name,
      contact_id: contactId,
      email,
      role: 'attendee',
    })
    qc.invalidateQueries({ queryKey: ['meeting', meeting.id] })
    setInput('')
    setShowSuggestions(false)
  }

  async function removeAttendee(id: string) {
    await supabase.from('meeting_attendees').delete().eq('id', id)
    qc.invalidateQueries({ queryKey: ['meeting', meeting.id] })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault()
      addAttendee(input.trim())
    }
    if (e.key === 'Escape') { setInput(''); setShowSuggestions(false) }
  }

  return (
    <div>
      <p className="text-[10px] text-gray-400 font-medium mb-2 flex items-center gap-1">
        <UserPlus size={10} /> 참석자
      </p>

      {/* 카드 그리드 */}
      {attendees.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5 mb-2">
          {attendees.map(a => (
            <div
              key={a.id}
              className="group relative flex items-start gap-1.5 p-2 rounded-lg
                         border border-gray-200 dark:border-gray-700
                         bg-white dark:bg-gray-800/60"
            >
              {/* 이니셜 아바타 */}
              <div className="shrink-0 w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700
                              flex items-center justify-center text-[10px] font-semibold
                              text-gray-500 dark:text-gray-400">
                {a.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-gray-700 dark:text-gray-300 truncate leading-tight">
                  {a.name}
                </p>
                {a.email ? (
                  <p className="text-[10px] text-gray-400 truncate leading-tight">{a.email}</p>
                ) : (
                  <p className="text-[10px] text-gray-300 dark:text-gray-600 leading-tight">미등록</p>
                )}
              </div>
              <button
                onClick={() => removeAttendee(a.id)}
                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity
                           text-gray-300 hover:text-red-400 dark:text-gray-600 dark:hover:text-red-400"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 입력 */}
      <div className="relative">
        <input
          ref={inputRef}
          value={input}
          onChange={e => { setInput(e.target.value); setShowSuggestions(true) }}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder="이름 입력 후 Enter"
          className="w-full text-xs px-2 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600
                     bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300
                     placeholder:text-gray-300 dark:placeholder:text-gray-600
                     focus:outline-none focus:border-blue-400"
        />

        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 z-10 bg-white dark:bg-gray-800
                          border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
            {suggestions.map(c => (
              <button
                key={c.id}
                onMouseDown={() => addAttendee(c.name, c.id, c.email)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left
                           hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                <span className="font-medium">{c.name}</span>
                {c.email && <span className="text-gray-400 truncate">{c.email}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
