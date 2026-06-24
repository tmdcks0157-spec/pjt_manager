'use client'

import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { Markdown } from 'tiptap-markdown'
import { Bold, Italic, List, ListChecks, Code, Quote, Table as TableIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  defaultValue?: string
  onChange: (value: string) => void
  placeholder?: string
}

export default function MarkdownEditor({ defaultValue = '', onChange, placeholder }: Props) {
  const [showTablePicker, setShowTablePicker] = useState(false)
  const [tableRows, setTableRows] = useState(3)
  const [tableCols, setTableCols] = useState(3)
  const tablePickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showTablePicker) return
    function handleClickOutside(e: MouseEvent) {
      if (tablePickerRef.current && !tablePickerRef.current.contains(e.target as Node)) {
        setShowTablePicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showTablePicker])

  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: placeholder ?? '내용을 입력하세요...' }),
      Markdown.configure({ html: false, transformPastedText: true }),
    ],
    content: defaultValue,
    onUpdate: ({ editor }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onChange((editor.storage as any).markdown.getMarkdown())
    },
    editorProps: {
      attributes: { class: 'md-editor-content min-h-[200px] px-4 py-3 focus:outline-none' },
    },
  })

  if (!editor) return null

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800">
      {/* 툴바 */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 dark:border-gray-700 flex-wrap bg-gray-50 dark:bg-gray-800/50">
        <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="굵게 (Ctrl+B)">
          <Bold size={13} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="기울기 (Ctrl+I)">
          <Italic size={13} />
        </ToolBtn>
        <Divider />
        {([1, 2, 3] as const).map(level => (
          <ToolBtn key={level}
            onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
            active={editor.isActive('heading', { level })}
            title={`H${level}`}
          >
            <span className="text-[11px] font-bold">H{level}</span>
          </ToolBtn>
        ))}
        <Divider />
        <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="불릿 리스트">
          <List size={13} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} title="체크리스트">
          <ListChecks size={13} />
        </ToolBtn>
        <Divider />
        <ToolBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="인라인 코드">
          <Code size={13} />
        </ToolBtn>
        <ToolBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="코드 블록">
          <span className="text-[10px] font-mono font-bold px-0.5">```</span>
        </ToolBtn>
        <Divider />
        <ToolBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="인용">
          <Quote size={13} />
        </ToolBtn>
        <Divider />
        <div className="relative" ref={tablePickerRef}>
          <ToolBtn
            onClick={() => setShowTablePicker(v => !v)}
            active={editor.isActive('table') || showTablePicker}
            title="표 삽입"
          >
            <TableIcon size={13} />
          </ToolBtn>
          {showTablePicker && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg p-3 w-44">
              <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-2">표 크기</p>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1">
                  <label className="text-[10px] text-gray-400 mb-1 block">행</label>
                  <input
                    type="number" min={1} max={10} value={tableRows}
                    onChange={e => setTableRows(Math.min(10, Math.max(1, Number(e.target.value))))}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 text-sm text-center dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-300"
                  />
                </div>
                <span className="text-gray-400 text-sm mt-4">×</span>
                <div className="flex-1">
                  <label className="text-[10px] text-gray-400 mb-1 block">열</label>
                  <input
                    type="number" min={1} max={10} value={tableCols}
                    onChange={e => setTableCols(Math.min(10, Math.max(1, Number(e.target.value))))}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-2 py-1 text-sm text-center dark:bg-gray-700 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-300"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  editor.chain().focus().insertTable({ rows: tableRows, cols: tableCols, withHeaderRow: true }).run()
                  setShowTablePicker(false)
                }}
                className="w-full py-1.5 bg-gray-900 dark:bg-gray-700 text-white rounded-lg text-xs font-medium hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
              >
                표 삽입 ({tableRows}×{tableCols})
              </button>
            </div>
          )}
        </div>
      </div>
      {/* 에디터 본문 */}
      <EditorContent editor={editor} />
    </div>
  )
}

function ToolBtn({ onClick, active, title, children }: {
  onClick: () => void
  active: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button type="button" onClick={onClick} title={title}
      className={cn(
        'p-1.5 rounded transition-colors min-w-[26px] flex items-center justify-center',
        active
          ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-gray-100'
          : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300'
      )}>
      {children}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-4 bg-gray-200 dark:bg-gray-700 mx-1 shrink-0" />
}
