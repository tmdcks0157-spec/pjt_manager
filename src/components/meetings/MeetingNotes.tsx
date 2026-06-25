'use client'

import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import { Bold, Italic, Heading2, CheckSquare, Table, Minus, Quote } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { Meeting } from '@/types'

interface Props {
  meeting: Meeting
  onUpdate: (patch: Partial<Meeting>) => void
}

function TBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-1 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100
                 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors"
    >
      {children}
    </button>
  )
}

export default function MeetingNotes({ meeting, onUpdate }: Props) {
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')
  const [notes, setNotes] = useState(meeting.notes)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  // 선택 영역 감싸기
  function wrapSelection(prefix: string, suffix = '') {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = notes.slice(start, end)
    const next = notes.slice(0, start) + prefix + selected + suffix + notes.slice(end)
    handleChange(next)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + prefix.length, start + prefix.length + selected.length)
    }, 0)
  }

  // 현재 줄 앞에 접두사 삽입
  function insertLinePrefix(prefix: string) {
    const el = textareaRef.current
    if (!el) return
    const lineStart = notes.lastIndexOf('\n', el.selectionStart - 1) + 1
    const next = notes.slice(0, lineStart) + prefix + notes.slice(lineStart)
    handleChange(next)
    setTimeout(() => {
      el.focus()
      const newPos = el.selectionStart + prefix.length
      el.setSelectionRange(newPos, newPos)
    }, 0)
  }

  // 커서 위치에 텍스트 삽입
  function insertAtCursor(text: string) {
    const el = textareaRef.current
    if (!el) return
    const pos = el.selectionStart
    const next = notes.slice(0, pos) + text + notes.slice(pos)
    handleChange(next)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(pos + text.length, pos + text.length)
    }, 0)
  }

  function insertTable() {
    insertAtCursor('\n| 항목 | 내용 1 | 내용 2 |\n|------|--------|--------|\n|      |        |        |\n|      |        |        |\n')
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 탭 + 툴바 */}
      <div className="flex items-center gap-1 px-3 pt-2 pb-1.5 border-b border-gray-100 dark:border-gray-800 shrink-0">
        {/* 마크다운 툴바 (편집 모드일 때만) */}
        {tab === 'edit' && (
          <div className="flex items-center gap-0.5 mr-2">
            <TBtn onClick={() => wrapSelection('**', '**')} title="굵게 (Ctrl+B)">
              <Bold size={13} />
            </TBtn>
            <TBtn onClick={() => wrapSelection('*', '*')} title="기울임">
              <Italic size={13} />
            </TBtn>
            <TBtn onClick={() => insertLinePrefix('## ')} title="제목">
              <Heading2 size={13} />
            </TBtn>
            <TBtn onClick={() => insertLinePrefix('> ')} title="인용">
              <Quote size={13} />
            </TBtn>
            <TBtn onClick={() => insertLinePrefix('- [ ] ')} title="체크리스트">
              <CheckSquare size={13} />
            </TBtn>
            <div className="w-px h-3.5 bg-gray-200 dark:bg-gray-700 mx-0.5" />
            <TBtn onClick={insertTable} title="표 삽입">
              <Table size={13} />
            </TBtn>
            <TBtn onClick={() => insertAtCursor('\n---\n')} title="구분선">
              <Minus size={13} />
            </TBtn>
          </div>
        )}

        {/* 탭 토글 */}
        <div className="flex items-center gap-1 ml-auto">
          {(['edit', 'preview'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-2.5 py-1 text-xs rounded-md transition-colors',
                tab === t
                  ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-400'
              )}
            >
              {t === 'edit' ? '편집' : '미리보기'}
            </button>
          ))}
          <span className="ml-1 text-[10px] text-gray-300 dark:text-gray-600">자동저장</span>
        </div>
      </div>

      {tab === 'edit' ? (
        <textarea
          ref={textareaRef}
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
