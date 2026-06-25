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

function TBtn({ onClick, title, active, children }: { onClick: () => void; title: string; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'p-1 rounded transition-colors',
        active
          ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
          : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-300 dark:hover:bg-gray-700'
      )}
    >
      {children}
    </button>
  )
}

// 그리드 피커 컴포넌트
function TablePicker({ onPick, onClose }: { onPick: (rows: number, cols: number) => void; onClose: () => void }) {
  const [hoverRow, setHoverRow] = useState(0)
  const [hoverCol, setHoverCol] = useState(0)
  const [gridRows, setGridRows] = useState(6)
  const [gridCols, setGridCols] = useState(6)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full mt-1 z-40 p-3
                 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                 rounded-xl shadow-xl"
      onMouseLeave={() => { setHoverRow(0); setHoverCol(0) }}
    >
      {/* 선택 크기 표시 */}
      <p className="text-[11px] text-center mb-2 h-4 font-medium text-gray-500 dark:text-gray-400">
        {hoverRow > 0 ? `${hoverRow} × ${hoverCol} 표` : '크기를 선택하세요'}
      </p>

      {/* 셀 그리드 */}
      <div className="flex flex-col gap-0.5">
        {Array.from({ length: gridRows }, (_, r) => (
          <div key={r} className="flex gap-0.5">
            {Array.from({ length: gridCols }, (_, c) => (
              <div
                key={c}
                className={cn(
                  'w-6 h-6 rounded border-2 cursor-pointer transition-all duration-75',
                  r < hoverRow && c < hoverCol
                    ? 'bg-blue-200 border-blue-400 dark:bg-blue-800/60 dark:border-blue-500'
                    : 'bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                )}
                onMouseEnter={() => { setHoverRow(r + 1); setHoverCol(c + 1) }}
                onClick={() => { onPick(r + 1, c + 1); onClose() }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* 행/열 크기 조절 */}
      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-400 w-4">행</span>
          <button
            onClick={() => setGridRows(r => Math.max(2, r - 1))}
            className="w-5 h-5 flex items-center justify-center text-xs rounded
                       text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium"
          >−</button>
          <span className="w-4 text-center text-[11px] text-gray-600 dark:text-gray-300 font-medium">{gridRows}</span>
          <button
            onClick={() => setGridRows(r => Math.min(12, r + 1))}
            className="w-5 h-5 flex items-center justify-center text-xs rounded
                       text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium"
          >+</button>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-400 w-4">열</span>
          <button
            onClick={() => setGridCols(c => Math.max(2, c - 1))}
            className="w-5 h-5 flex items-center justify-center text-xs rounded
                       text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium"
          >−</button>
          <span className="w-4 text-center text-[11px] text-gray-600 dark:text-gray-300 font-medium">{gridCols}</span>
          <button
            onClick={() => setGridCols(c => Math.min(12, c + 1))}
            className="w-5 h-5 flex items-center justify-center text-xs rounded
                       text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium"
          >+</button>
        </div>
      </div>
    </div>
  )
}

export default function MeetingNotes({ meeting, onUpdate }: Props) {
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')
  const [notes, setNotes] = useState(meeting.notes)
  const [showTablePicker, setShowTablePicker] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { setNotes(meeting.notes) }, [meeting.id])
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  function handleChange(value: string) {
    setNotes(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      await supabase.from('meetings').update({ notes: value }).eq('id', meeting.id)
      onUpdate({ notes: value })
    }, 1000)
  }

  function wrapSelection(prefix: string, suffix = '') {
    const el = textareaRef.current
    if (!el) return
    const start = el.selectionStart
    const end = el.selectionEnd
    const selected = notes.slice(start, end)
    handleChange(notes.slice(0, start) + prefix + selected + suffix + notes.slice(end))
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + prefix.length, start + prefix.length + selected.length)
    }, 0)
  }

  function insertLinePrefix(prefix: string) {
    const el = textareaRef.current
    if (!el) return
    const lineStart = notes.lastIndexOf('\n', el.selectionStart - 1) + 1
    handleChange(notes.slice(0, lineStart) + prefix + notes.slice(lineStart))
    setTimeout(() => {
      el.focus()
      const p = el.selectionStart + prefix.length
      el.setSelectionRange(p, p)
    }, 0)
  }

  function insertAtCursor(text: string) {
    const el = textareaRef.current
    if (!el) return
    const pos = el.selectionStart
    handleChange(notes.slice(0, pos) + text + notes.slice(pos))
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(pos + text.length, pos + text.length)
    }, 0)
  }

  function buildTable(rows: number, cols: number): string {
    const header = '| ' + Array(cols).fill('열').map((_, i) => `열${i + 1}`).join(' | ') + ' |'
    const sep    = '| ' + Array(cols).fill('---').join(' | ') + ' |'
    const row    = '| ' + Array(cols).fill('   ').join(' | ') + ' |'
    return '\n' + header + '\n' + sep + '\n' + Array(rows - 1).fill(row).join('\n') + '\n'
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 탭 + 툴바 */}
      <div className="flex items-center gap-1 px-3 pt-2 pb-1.5 border-b border-gray-100 dark:border-gray-800 shrink-0">
        {tab === 'edit' && (
          <div className="flex items-center gap-0.5 mr-2">
            <TBtn onClick={() => wrapSelection('**', '**')} title="굵게"><Bold size={13} /></TBtn>
            <TBtn onClick={() => wrapSelection('*', '*')} title="기울임"><Italic size={13} /></TBtn>
            <TBtn onClick={() => insertLinePrefix('## ')} title="제목"><Heading2 size={13} /></TBtn>
            <TBtn onClick={() => insertLinePrefix('> ')} title="인용"><Quote size={13} /></TBtn>
            <TBtn onClick={() => insertLinePrefix('- [ ] ')} title="체크리스트"><CheckSquare size={13} /></TBtn>
            <div className="w-px h-3.5 bg-gray-200 dark:bg-gray-700 mx-0.5" />

            {/* 표 삽입 — 그리드 피커 */}
            <div className="relative">
              <TBtn
                onClick={() => setShowTablePicker(v => !v)}
                title="표 삽입"
                active={showTablePicker}
              >
                <Table size={13} />
              </TBtn>
              {showTablePicker && (
                <TablePicker
                  onPick={(r, c) => insertAtCursor(buildTable(r, c))}
                  onClose={() => setShowTablePicker(false)}
                />
              )}
            </div>

            <TBtn onClick={() => insertAtCursor('\n---\n')} title="구분선"><Minus size={13} /></TBtn>
          </div>
        )}

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
