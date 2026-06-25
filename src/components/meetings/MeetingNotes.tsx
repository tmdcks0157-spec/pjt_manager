'use client'

import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { Meeting } from '@/types'

interface Props {
  meeting: Meeting
  onUpdate: (patch: Partial<Meeting>) => void
}

export default function MeetingNotes({ meeting, onUpdate }: Props) {
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')
  const [notes, setNotes] = useState(meeting.notes)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setNotes(meeting.notes)
  }, [meeting.id])

  function handleChange(value: string) {
    setNotes(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      await supabase.from('meetings').update({ notes: value }).eq('id', meeting.id)
      onUpdate({ notes: value })
    }, 1000)
  }

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 탭 */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-2 border-b border-gray-100 dark:border-gray-800 shrink-0">
        {(['edit', 'preview'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-3 py-1 text-xs rounded-md transition-colors',
              tab === t
                ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-400'
            )}
          >
            {t === 'edit' ? '편집' : '미리보기'}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-gray-300 dark:text-gray-600">자동 저장</span>
      </div>

      {tab === 'edit' ? (
        <textarea
          value={notes}
          onChange={e => handleChange(e.target.value)}
          placeholder={`## 회의 메모\n\n마크다운으로 자유롭게 기록하세요.\n- [ ] 체크리스트\n- **굵은 글씨**\n- \`코드\``}
          className="flex-1 resize-none bg-transparent text-sm text-gray-800 dark:text-gray-200
                     placeholder:text-gray-300 dark:placeholder:text-gray-600
                     focus:outline-none font-mono leading-relaxed p-4"
        />
      ) : (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
              {notes || '*아직 작성된 내용이 없습니다.*'}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}
