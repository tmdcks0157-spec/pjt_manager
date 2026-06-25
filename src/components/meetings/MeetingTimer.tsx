'use client'

import { useState, useEffect } from 'react'
import { Play, Square } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Meeting } from '@/types'

interface Props {
  meeting: Meeting
  onUpdate: (patch: Partial<Meeting>) => void
}

function formatTime(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0')
  const sec = (s % 60).toString().padStart(2, '0')
  return h > 0 ? `${h}:${m}:${sec}` : `${m}:${sec}`
}

export default function MeetingTimer({ meeting, onUpdate }: Props) {
  const [elapsed, setElapsed] = useState(() => {
    if (meeting.started_at && meeting.status === 'in_progress') {
      return Math.floor((Date.now() - new Date(meeting.started_at).getTime()) / 1000)
    }
    return (meeting.duration_minutes ?? 0) * 60
  })

  useEffect(() => {
    if (meeting.status !== 'in_progress') return
    const id = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(id)
  }, [meeting.status])

  async function handleStart() {
    const now = new Date().toISOString()
    await supabase.from('meetings').update({ status: 'in_progress', started_at: now }).eq('id', meeting.id)
    setElapsed(0)
    onUpdate({ status: 'in_progress', started_at: now })
  }

  async function handleStop() {
    const duration = Math.max(1, Math.round(elapsed / 60))
    await supabase.from('meetings').update({ status: 'completed', duration_minutes: duration }).eq('id', meeting.id)
    onUpdate({ status: 'completed', duration_minutes: duration })
  }

  if (meeting.status === 'scheduled') {
    return (
      <button
        onClick={handleStart}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm
                   hover:bg-green-700 transition-colors"
      >
        <Play size={13} />
        회의 시작
      </button>
    )
  }

  if (meeting.status === 'in_progress') {
    return (
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm font-medium text-green-600 dark:text-green-400 tabular-nums">
          {formatTime(elapsed)}
        </span>
        <button
          onClick={handleStop}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs
                     hover:bg-red-600 transition-colors"
        >
          <Square size={11} />
          종료
        </button>
      </div>
    )
  }

  return (
    <span className="text-xs text-gray-500 dark:text-gray-400">
      {meeting.duration_minutes != null ? `${meeting.duration_minutes}분 완료` : '완료'}
    </span>
  )
}
