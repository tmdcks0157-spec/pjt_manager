# Design: markdown-notes — 옵시디언 스타일 마크다운 노트

> Plan 참조: `docs/01-plan/features/markdown-notes.plan.md`

---

## 1. 구현 범위 확정

| # | 항목 | 포함 |
|---|------|------|
| 1 | tiptap WYSIWYG 에디터 (타이핑 즉시 렌더링) | ✅ |
| 2 | 툴바 (B I H1 H2 H3 리스트 체크리스트 코드 인용 **테이블**) | ✅ |
| 3 | 마크다운 단축키 (# → H1, `- [ ]` → 체크박스 등) | ✅ |
| 4 | 테이블 삽입 + 셀 편집 (Tab으로 이동) | ✅ |
| 5 | 읽기 전용 뷰어 (react-markdown + 코드 하이라이트 + 테이블) | ✅ |
| 6 | issues/page.tsx 교체 (textarea → MarkdownEditor, body → MarkdownViewer) | ✅ |
| 7 | 커스텀 prose CSS (Tailwind v4, typography 플러그인 없음) | ✅ |
| 8 | dark 모드 완전 지원 | ✅ |
| DB 변경 | 없음 — body TEXT 그대로 | ✅ |

---

## 2. 아키텍처

```
src/components/ui/
  MarkdownEditor.tsx    (신규) — tiptap WYSIWYG 에디터 + 툴바
  MarkdownViewer.tsx    (신규) — react-markdown 읽기 전용 뷰어

src/app/(main)/projects/[id]/issues/page.tsx
  - textarea → <MarkdownEditor key={editPost?.id ?? 'new'} />
  - {post.body} 텍스트 → <MarkdownViewer content={post.body} />
  - bodyRef, autoResize 제거

src/app/globals.css
  - .md-editor-content (tiptap 에디터 내부 prose 스타일)
  - .md-body (MarkdownViewer 렌더링 스타일)
```

---

## 3. 패키지

```bash
npm install @tiptap/react @tiptap/starter-kit
npm install @tiptap/extension-task-list @tiptap/extension-task-item
npm install @tiptap/extension-placeholder
npm install @tiptap/extension-table @tiptap/extension-table-row @tiptap/extension-table-cell @tiptap/extension-table-header
npm install tiptap-markdown
npm install react-markdown remark-gfm rehype-highlight rehype-sanitize
```

| 패키지 | 용도 |
|--------|------|
| `@tiptap/react` | tiptap React 바인딩 |
| `@tiptap/starter-kit` | 핵심 extensions (bold, italic, heading, list, code, blockquote...) |
| `@tiptap/extension-task-list/item` | `- [ ]` 체크박스 |
| `@tiptap/extension-placeholder` | placeholder 텍스트 |
| `@tiptap/extension-table` + `table-row/cell/header` | 테이블 삽입·편집 |
| `tiptap-markdown` | 마크다운 ↔ tiptap JSON 직렬화 (테이블 포함) |
| `react-markdown` | 읽기 전용 렌더러 |
| `remark-gfm` | GFM — 테이블, 체크박스, 취소선 |
| `rehype-highlight` | 코드 하이라이팅 |
| `rehype-sanitize` | XSS 방지 |

---

## 4. `MarkdownEditor.tsx` 상세 설계

**파일:** `src/components/ui/MarkdownEditor.tsx`

```tsx
'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from 'tiptap-markdown'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { Bold, Italic, List, ListChecks, Code, Quote, Table as TableIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  defaultValue?: string
  onChange: (value: string) => void
  placeholder?: string
}

export default function MarkdownEditor({ defaultValue = '', onChange, placeholder }: Props) {
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
      onChange(editor.storage.markdown.getMarkdown())
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
        <ToolBtn
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          active={editor.isActive('table')}
          title="표 삽입 (3×3)"
        >
          <TableIcon size={13} />
        </ToolBtn>
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
```

### 핵심 패턴

- **`key` prop으로 리마운트**: `issues/page.tsx`에서 `<MarkdownEditor key={editPost?.id ?? 'new'} />`
  — 새 글 / 편집 전환 시 에디터를 재생성해 내용 초기화. controlled 패턴 없음.
- **`defaultValue`**: 초기 마크다운 문자열. `tiptap-markdown`이 JSON으로 자동 파싱.
- **`onChange`**: `editor.storage.markdown.getMarkdown()` → `setFormBody` 콜백

---

## 5. `MarkdownViewer.tsx` 상세 설계

**파일:** `src/components/ui/MarkdownViewer.tsx`

```tsx
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import rehypeSanitize from 'rehype-sanitize'
import { cn } from '@/lib/utils'

export default function MarkdownViewer({ content, className }: {
  content: string
  className?: string
}) {
  if (!content) return null
  return (
    <div className={cn('md-body', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize, rehypeHighlight]}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
```

---

## 6. `globals.css` 추가 스타일

```css
/* ──── tiptap 에디터 내부 prose 스타일 ──── */
.md-editor-content h1 { font-size: 1.25rem; font-weight: 700; margin: 0.75rem 0 0.375rem; }
.md-editor-content h2 { font-size: 1.1rem; font-weight: 600; margin: 0.625rem 0 0.25rem; }
.md-editor-content h3 { font-size: 1rem; font-weight: 600; margin: 0.5rem 0 0.25rem; }
.md-editor-content ul { list-style: disc; padding-left: 1.25rem; margin: 0.25rem 0; }
.md-editor-content ol { list-style: decimal; padding-left: 1.25rem; margin: 0.25rem 0; }
.md-editor-content ul[data-type="taskList"] { list-style: none; padding-left: 0.5rem; }
.md-editor-content ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 0.5rem; }
.md-editor-content ul[data-type="taskList"] li > label { margin-top: 0.15rem; }
.md-editor-content ul[data-type="taskList"] li > label input { cursor: pointer; width: 14px; height: 14px; }
.md-editor-content blockquote { border-left: 3px solid #d1d5db; padding-left: 0.75rem; color: #6b7280; margin: 0.375rem 0; }
.md-editor-content code:not(pre code) { background: #f3f4f6; border-radius: 4px; padding: 0.1em 0.35em; font-size: 0.875em; font-family: monospace; }
.md-editor-content pre { background: #1e293b; color: #e2e8f0; border-radius: 0.5rem; padding: 0.75rem 1rem; margin: 0.5rem 0; overflow-x: auto; font-size: 0.8rem; }
.md-editor-content pre code { background: none; padding: 0; color: inherit; }
.md-editor-content p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: #9ca3af; pointer-events: none; float: left; height: 0; }
.md-editor-content strong { font-weight: 700; }
.md-editor-content em { font-style: italic; }
.md-editor-content table { border-collapse: collapse; width: 100%; margin: 0.5rem 0; }
.md-editor-content th { background: #f3f4f6; font-weight: 600; text-align: left; padding: 0.4rem 0.6rem; border: 1px solid #d1d5db; font-size: 0.8rem; }
.md-editor-content td { padding: 0.35rem 0.6rem; border: 1px solid #e5e7eb; font-size: 0.8rem; vertical-align: top; }
.md-editor-content td.selectedCell, .md-editor-content th.selectedCell { background: #dbeafe; }

/* dark 모드 */
.dark .md-editor-content blockquote { border-left-color: #4b5563; color: #9ca3af; }
.dark .md-editor-content code:not(pre code) { background: #374151; color: #e5e7eb; }
.dark .md-editor-content th { background: #374151; border-color: #4b5563; color: #e5e7eb; }
.dark .md-editor-content td { border-color: #4b5563; }
.dark .md-editor-content td.selectedCell, .dark .md-editor-content th.selectedCell { background: #1e3a5f; }

/* ──── 읽기 전용 뷰어 ──── */
.md-body { font-size: 0.875rem; line-height: 1.6; color: #374151; }
.md-body h1 { font-size: 1.125rem; font-weight: 700; margin: 0.5rem 0 0.25rem; }
.md-body h2 { font-size: 1rem; font-weight: 600; margin: 0.375rem 0 0.25rem; }
.md-body h3 { font-size: 0.9rem; font-weight: 600; margin: 0.25rem 0; }
.md-body ul { list-style: disc; padding-left: 1.25rem; }
.md-body ol { list-style: decimal; padding-left: 1.25rem; }
.md-body li { margin: 0.1rem 0; }
.md-body input[type="checkbox"] { margin-right: 0.4rem; }
.md-body blockquote { border-left: 3px solid #d1d5db; padding-left: 0.75rem; color: #6b7280; margin: 0.25rem 0; }
.md-body code:not(pre code) { background: #f3f4f6; border-radius: 4px; padding: 0.1em 0.35em; font-size: 0.8em; font-family: monospace; }
.md-body pre { background: #1e293b; color: #e2e8f0; border-radius: 0.5rem; padding: 0.6rem 0.875rem; margin: 0.375rem 0; overflow-x: auto; font-size: 0.75rem; }
.md-body pre code { background: none; padding: 0; color: inherit; }
.md-body strong { font-weight: 700; }
.md-body em { font-style: italic; }
.md-body p { margin: 0.15rem 0; }
.md-body table { border-collapse: collapse; width: 100%; margin: 0.375rem 0; }
.md-body th { background: #f3f4f6; font-weight: 600; text-align: left; padding: 0.35rem 0.6rem; border: 1px solid #d1d5db; font-size: 0.75rem; }
.md-body td { padding: 0.3rem 0.6rem; border: 1px solid #e5e7eb; font-size: 0.75rem; vertical-align: top; }

/* dark 모드 뷰어 */
.dark .md-body { color: #d1d5db; }
.dark .md-body blockquote { border-left-color: #4b5563; color: #9ca3af; }
.dark .md-body code:not(pre code) { background: #374151; color: #e5e7eb; }
.dark .md-body th { background: #374151; border-color: #4b5563; color: #e5e7eb; }
.dark .md-body td { border-color: #4b5563; }
```

---

## 7. `issues/page.tsx` 변경 상세

### 7-1. import 추가

```tsx
import MarkdownEditor from '@/components/ui/MarkdownEditor'
import MarkdownViewer from '@/components/ui/MarkdownViewer'
```

### 7-2. 제거

```tsx
// 제거할 것들
const bodyRef = useRef<HTMLTextAreaElement>(null)          // line 86
const autoResize = useCallback((el) => { ... }, [])       // lines 88-92
autoResize(bodyRef.current)                               // line 132
```

### 7-3. 뷰어 교체 (line 393-396)

```tsx
// Before
{post.body && (
  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap bg-gray-50 dark:bg-gray-700 rounded-xl px-3 py-2.5">
    {post.body}
  </p>
)}

// After
{post.body && (
  <div className="mt-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl px-3 py-2.5">
    <MarkdownViewer content={post.body} />
  </div>
)}
```

### 7-4. 에디터 교체 (line 503-513)

```tsx
// Before
<textarea
  ref={bodyRef}
  value={formBody}
  onChange={e => { setFormBody(e.target.value); autoResize(e.target) }}
  placeholder={...}
  rows={5}
  maxLength={5000}
  className="..."
/>

// After
<MarkdownEditor
  key={editPost?.id ?? 'new'}
  defaultValue={formBody}
  onChange={setFormBody}
  placeholder={formType === 'issue'
    ? '발생 상황, 재현 방법, 영향 범위 등을 자세히 적어주세요'
    : '메모, 회의록, 학습 내용 등을 자유롭게 기록하세요'}
/>
```

---

## 8. 파일별 변경 요약

| 파일 | 유형 | 변경 내용 |
|------|------|-----------|
| `src/components/ui/MarkdownEditor.tsx` | 신규 | tiptap 에디터 + 툴바 (9개 버튼) |
| `src/components/ui/MarkdownViewer.tsx` | 신규 | react-markdown 뷰어 |
| `src/app/globals.css` | 수정 | `.md-editor-content` + `.md-body` 스타일 추가 |
| `src/app/(main)/projects/[id]/issues/page.tsx` | 수정 | import 2개 추가, bodyRef/autoResize 제거, textarea/뷰어 교체 |

---

## 9. 구현 순서

```
1. npm install (13개 패키지)
2. src/app/globals.css — .md-editor-content + .md-body 스타일 추가 (테이블 포함)
3. src/components/ui/MarkdownViewer.tsx 작성
4. src/components/ui/MarkdownEditor.tsx 작성
5. src/app/(main)/projects/[id]/issues/page.tsx
   a. import 추가
   b. bodyRef, autoResize 제거
   c. useEffect에서 autoResize 호출 제거
   d. 뷰어 교체 (line 393-396)
   e. 에디터 교체 (line 503-513)
6. npx tsc --noEmit → 에러 0 확인
```

---

## 10. 테스트 시나리오

| 시나리오 | 기대 결과 |
|----------|-----------|
| `# ` 입력 후 타이핑 | H1 헤딩으로 즉시 렌더링 |
| `**굵게**` 입력 | **굵게** 텍스트로 렌더링 |
| `- [ ] 항목` 입력 | 클릭 가능한 체크박스 생성 |
| ``` ``` ``` + Enter | 코드 블록 생성 |
| 툴바 B 클릭 | 선택 텍스트 굵게 토글 |
| 저장 후 카드 표시 | markdown 파싱된 HTML 렌더링 |
| 기존 plain text 게시물 | whitespace-pre-wrap 없이도 그대로 표시 |
| 편집 버튼 클릭 | 기존 마크다운 에디터에 재로드 |
| 신규 작성 후 편집 전환 | key 변경으로 에디터 초기화 |
| 툴바 테이블 버튼 클릭 | 3×3 헤더 포함 표 삽입 |
| 표 셀 Tab 이동 | 다음 셀로 이동, 마지막 셀에서 새 행 추가 |
| 마크다운 \| col \| 붙여넣기 | tiptap-markdown이 표로 파싱 |
| 뷰어에서 표 표시 | 테두리 있는 표 렌더링 |
| dark 모드 표 | th 배경색, 테두리 dark 스타일 적용 |
| TypeScript 에러 | 0개 |
