'use client'

import { useRef } from 'react'
import { supabase } from '@/lib/supabase'
import MarkdownEditor from '@/components/ui/MarkdownEditor'
import type { Meeting } from '@/types'

interface Props {
  meeting: Meeting
  onUpdate: (patch: Partial<Meeting>) => void
}

export default function MeetingNotes({ meeting, onUpdate }: Props) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleChange(value: string) {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      await supabase.from('meetings').update({ notes: value }).eq('id', meeting.id)
      onUpdate({ notes: value })
    }, 1000)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 pt-2 pb-1.5 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">회의 노트</span>
        <span className="text-[10px] text-gray-300 dark:text-gray-600">자동저장</span>
      </div>
      <div className="flex-1 overflow-y-auto flex flex-col">
        <MarkdownEditor
          key={meeting.id}
          defaultValue={meeting.notes ?? ''}
          onChange={handleChange}
          placeholder="회의 내용을 자유롭게 기록하세요..."
          borderless
        />
      </div>
    </div>
  )
}
