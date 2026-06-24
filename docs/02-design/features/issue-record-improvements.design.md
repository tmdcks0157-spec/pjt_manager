# Design: issue-record-improvements — 이슈&기록 기능 강화 묶음

> 작성일: 2026-06-24  
> 참조: `docs/01-plan/features/issue-record-improvements.plan.md`

---

## 1. 구현 항목 목록 (체크리스트)

| # | 항목 | 파일 | 상태 |
|---|------|------|------|
| A-1 | `ViewType`에 `'notes'` 추가 | `overview/page.tsx` | □ |
| A-2 | `IssueFilterType`에서 `'note'` 제거 | `overview/page.tsx` | □ |
| A-3 | `filteredPosts` 분기 로직 변경 | `overview/page.tsx` | □ |
| A-4 | `issueStats`에서 `note` 제거 | `overview/page.tsx` | □ |
| A-5 | 탭 버튼 3개로 분리 (이슈/기록 별도 탭) | `overview/page.tsx` | □ |
| A-6 | 이슈 탭 필터 (열림/닫힘/전체) | `overview/page.tsx` | □ |
| A-7 | 기록 탭 필터 (전체/열림/닫힘) | `overview/page.tsx` | □ |
| B-1 | `TaskModal` import 추가 | `crm/contacts/[id]/page.tsx` | □ |
| B-2 | `selectedTask` state 추가 | `crm/contacts/[id]/page.tsx` | □ |
| B-3 | `useAllColumns` import + doneColId 계산 | `crm/contacts/[id]/page.tsx` | □ |
| B-4 | 태스크 카드 클릭 → `setSelectedTask` | `crm/contacts/[id]/page.tsx` | □ |
| B-5 | 완료 태스크 취소선 스타일 | `crm/contacts/[id]/page.tsx` | □ |
| B-6 | `TaskModal` 렌더 | `crm/contacts/[id]/page.tsx` | □ |
| C-1 | 이슈/기록 요약 stat 카드 추가 | `report/page.tsx` | □ |
| D-1 | `showTablePicker` state 추가 | `MarkdownEditor.tsx` | □ |
| D-2 | 행/열 number input 팝오버 UI | `MarkdownEditor.tsx` | □ |
| D-3 | 확인 클릭 → `insertTable({ rows, cols })` | `MarkdownEditor.tsx` | □ |
| D-4 | 외부 클릭 팝오버 닫힘 처리 | `MarkdownEditor.tsx` | □ |
| E-1 | Supabase `posts` 테이블 `tags TEXT[]` 컬럼 추가 | SQL | □ |
| E-2 | `Post` 인터페이스에 `tags: string[]` 추가 | `types/index.ts` | □ |
| E-3 | 이슈 모달 태그 입력 UI | `projects/[id]/issues/page.tsx` | □ |
| E-4 | 이슈 저장/수정 시 `tags` 포함 | `projects/[id]/issues/page.tsx` | □ |
| E-5 | 이슈 탭 태그 필터 pills | `projects/[id]/issues/page.tsx` | □ |

---

## 2. Sub-feature A — 이슈&기록 탭 분리 (`overview/page.tsx`)

### 2.1 현재 코드 (변경 지점)

```tsx
// line 24
type IssueFilterType = 'all' | 'open' | 'closed' | 'note'  // ← 'note' 제거
type ViewType        = 'tasks' | 'issues'                    // ← 'notes' 추가

// line 183-188 issueStats
const issueStats = useMemo(() => ({
  total:  allPosts.length,
  open:   allPosts.filter(p => p.type === 'issue' && p.status === 'open').length,
  closed: allPosts.filter(p => p.type === 'issue' && p.status === 'closed').length,
  note:   allPosts.filter(p => p.type === 'note').length,   // ← 별도 변수로 분리
}), [allPosts])

// line 142-149 filteredPosts
const filteredPosts = useMemo(() => {
  switch (issueFilter) {
    case 'open':   return allPosts.filter(p => p.type === 'issue' && p.status === 'open')
    case 'closed': return allPosts.filter(p => p.type === 'issue' && p.status === 'closed')
    case 'note':   return allPosts.filter(p => p.type === 'note')   // ← 탭 분리로 제거
    default:       return allPosts
  }
}, [allPosts, issueFilter])
```

### 2.2 변경 후 코드

```tsx
type IssueFilterType = 'all' | 'open' | 'closed'  // 'note' 제거
type ViewType        = 'tasks' | 'issues' | 'notes'

// issueStats: note 분리
const issueStats = useMemo(() => ({
  issues: allPosts.filter(p => p.type === 'issue').length,
  open:   allPosts.filter(p => p.type === 'issue' && p.status === 'open').length,
  closed: allPosts.filter(p => p.type === 'issue' && p.status === 'closed').length,
  notes:  allPosts.filter(p => p.type === 'note').length,
}), [allPosts])

// filteredPosts: view 기반으로 분기
const filteredPosts = useMemo(() => {
  const base = view === 'notes'
    ? allPosts.filter(p => p.type === 'note')
    : allPosts.filter(p => p.type === 'issue')
  switch (issueFilter) {
    case 'open':   return base.filter(p => p.status === 'open')
    case 'closed': return base.filter(p => p.status === 'closed')
    default:       return base
  }
}, [allPosts, view, issueFilter])
```

### 2.3 탭 버튼 UI

```tsx
// 기존 2탭 → 3탭
<div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
  {/* 태스크 현황 — 기존 유지 */}
  <button onClick={() => { setView('tasks'); setSelected(null) }} ...>
    <CheckSquare size={14} /> 태스크 현황
  </button>

  {/* 이슈 — 신규 분리 */}
  <button onClick={() => { setView('issues'); setIssueFilter('all'); setSelected(null) }} ...>
    <MessageSquare size={14} /> 이슈
    {issueStats.open > 0 && (
      <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">
        {issueStats.open}
      </span>
    )}
  </button>

  {/* 기록 — 신규 분리 */}
  <button onClick={() => { setView('notes'); setIssueFilter('all'); setSelected(null) }} ...>
    <BookOpen size={14} /> 기록
    {issueStats.notes > 0 && (
      <span className="text-[10px] font-bold bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full">
        {issueStats.notes}
      </span>
    )}
  </button>
</div>
```

### 2.4 이슈/기록 필터 pills

```tsx
// 이슈 탭 필터 (view === 'issues')
const ISSUE_FILTERS = [
  { key: 'all',    label: '전체', count: issueStats.issues },
  { key: 'open',   label: '열림', count: issueStats.open },
  { key: 'closed', label: '닫힘', count: issueStats.closed },
]

// 기록 탭 필터 (view === 'notes') — 기록도 open/closed 상태 있으므로 동일 구조
const NOTE_FILTERS = [
  { key: 'all',    label: '전체', count: issueStats.notes },
  { key: 'open',   label: '열림', count: allPosts.filter(p => p.type === 'note' && p.status === 'open').length },
  { key: 'closed', label: '닫힘', count: allPosts.filter(p => p.type === 'note' && p.status === 'closed').length },
]
```

---

## 3. Sub-feature B — 연락처 연결된 태스크 (`crm/contacts/[id]/page.tsx`)

### 3.1 추가 import

```tsx
import TaskModal from '@/components/kanban/TaskModal'
import { useAllColumns } from '@/hooks/useAllColumns'
import { CheckCircle2, ExternalLink } from 'lucide-react'  // 이미 있는 아이콘 확인 필요
```

### 3.2 state 및 hook 추가

```tsx
const [selectedTask, setSelectedTask] = useState<Task | null>(null)
const { data: columns = [] } = useAllColumns()

// 완료 컬럼 id set
const doneColIds = useMemo(
  () => new Set(columns.filter(c => c.name === '완료').map(c => c.id)),
  [columns]
)
```

### 3.3 태스크 카드 변경 (line 240-248)

**현재:**
```tsx
<div key={task.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/50">
  <p className="flex-1 text-sm text-gray-800 dark:text-gray-200">{task.title}</p>
  {task.due_date && (
    <span className="text-[10px] text-gray-400 shrink-0">{task.due_date.slice(0, 10)}</span>
  )}
</div>
```

**변경 후:**
```tsx
{tasks.map(task => {
  const isDone = doneColIds.has(task.status)
  return (
    <div
      key={task.id}
      onClick={() => setSelectedTask(task)}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
    >
      <CheckCircle2
        className={cn('w-4 h-4 shrink-0', isDone ? 'text-green-500' : 'text-gray-300 dark:text-gray-600')}
      />
      <p className={cn('flex-1 text-sm', isDone
        ? 'line-through text-gray-400 dark:text-gray-500'
        : 'text-gray-800 dark:text-gray-200'
      )}>
        {task.title}
      </p>
      {task.due_date && (
        <span className="text-[10px] text-gray-400 shrink-0">{task.due_date.slice(0, 10)}</span>
      )}
      <ExternalLink className="w-3.5 h-3.5 text-gray-400 shrink-0 opacity-0 group-hover:opacity-100" />
    </div>
  )
})}
```

### 3.4 TaskModal 렌더 (컴포넌트 최하단)

```tsx
{selectedTask && (
  <TaskModal
    task={selectedTask}
    onClose={() => setSelectedTask(null)}
  />
)}
```

> **주의**: TaskModal의 props 시그니처 확인 필요 (`projects/[id]/page.tsx` line 412 참고 — `task`, `onClose` 패턴)

---

## 4. Sub-feature C — 리포트 이슈/기록 통계 (`report/page.tsx`)

### 4.1 현재 상태

- `weeklyPosts` 쿼리 이미 존재 (line 87-102)
- "이번 주 이슈/기록" **리스트** 이미 표시 (line 479-522)
- **누락**: 요약 stat 카드 (top 3개 카드 영역)

### 4.2 추가할 내용 — stat 카드 확장

현재 요약 카드는 3개 (`grid-cols-3`): 생성 / 완료 / 기한초과

**변경 방향**: 기존 3개 카드 아래 이슈/기록 요약 행 추가 (별도 row)

```tsx
{/* 이슈/기록 요약 카드 — weeklyPosts가 있을 때만 표시 */}
{weeklyPosts.length > 0 && (
  <div className="grid grid-cols-3 gap-4 mb-8">
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-center">
      <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mx-auto mb-2">
        <MessageSquare size={15} className="text-blue-500" />
      </div>
      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
        {weeklyPosts.filter(p => p.type === 'issue').length}
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">이슈 등록</p>
    </div>
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-center">
      <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-2">
        <AlertCircle size={15} className="text-red-500" />
      </div>
      <p className="text-2xl font-bold text-red-600 dark:text-red-400">
        {weeklyPosts.filter(p => p.type === 'issue' && p.status === 'open').length}
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">미해결 이슈</p>
    </div>
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-center">
      <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center mx-auto mb-2">
        <FileText size={15} className="text-purple-500" />
      </div>
      <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
        {weeklyPosts.filter(p => p.type === 'note').length}
      </p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">기록 작성</p>
    </div>
  </div>
)}
```

> `AlertCircle`, `FileText`는 이미 import 되어 있음 (line 11 확인)

### 4.3 배치 위치

기존 task stat 카드 (line 340) **바로 아래**, BarChart **위** 에 삽입.

---

## 5. Sub-feature D — tiptap 표 커스텀 크기 (`MarkdownEditor.tsx`)

### 5.1 현재 코드 (line 86-92)

```tsx
<ToolBtn
  onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
  active={editor.isActive('table')}
  title="표 삽입 (3×3)"
>
  <TableIcon size={13} />
</ToolBtn>
```

### 5.2 변경 후 — 팝오버 방식

```tsx
// state 추가 (컴포넌트 내부)
const [showTablePicker, setShowTablePicker] = useState(false)
const [tableRows, setTableRows] = useState(3)
const [tableCols, setTableCols] = useState(3)
const tablePickerRef = useRef<HTMLDivElement>(null)

// 외부 클릭 닫힘
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

// 툴바 버튼 + 팝오버
<div className="relative" ref={tablePickerRef}>
  <ToolBtn
    onClick={() => setShowTablePicker(v => !v)}
    active={editor.isActive('table') || showTablePicker}
    title="표 삽입"
  >
    <TableIcon size={13} />
  </ToolBtn>

  {showTablePicker && (
    <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg p-3 w-48">
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
        <span className="text-gray-400 mt-4">×</span>
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
```

---

## 6. Sub-feature E — 이슈/기록 태그 기능

### 6.1 DB 변경 (Supabase SQL Editor에서 직접 실행)

```sql
ALTER TABLE posts ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
```

### 6.2 타입 변경 (`src/types/index.ts`)

```ts
export interface Post {
  id: string
  project_id: string
  contact_id?: string | null
  type: 'issue' | 'note'
  title: string
  body?: string | null
  status: 'open' | 'closed'
  priority: string
  tags: string[]        // ← 추가
  created_at: string
}
```

### 6.3 이슈 모달 태그 입력 (`projects/[id]/issues/page.tsx`)

**태그 입력 state (모달 내부):**
```tsx
const [tagInput, setTagInput] = useState('')
const [editTags, setEditTags] = useState<string[]>([])

// 모달 열릴 때 초기화
// editTags = editPost?.tags ?? []

function addTag(tag: string) {
  const trimmed = tag.trim().toLowerCase()
  if (trimmed && !editTags.includes(trimmed)) {
    setEditTags(prev => [...prev, trimmed])
  }
  setTagInput('')
}
```

**태그 입력 UI (모달 폼 내):**
```tsx
<div>
  <label className="block text-xs font-medium text-gray-500 mb-1.5">태그</label>
  {/* 기존 태그 chips */}
  <div className="flex flex-wrap gap-1.5 mb-2">
    {editTags.map(tag => (
      <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
        #{tag}
        <button onClick={() => setEditTags(prev => prev.filter(t => t !== tag))} className="text-gray-400 hover:text-gray-600">
          <X size={10} />
        </button>
      </span>
    ))}
  </div>
  {/* 입력창 */}
  <input
    value={tagInput}
    onChange={e => setTagInput(e.target.value)}
    onKeyDown={e => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault()
        addTag(tagInput)
      }
    }}
    placeholder="태그 입력 후 Enter"
    className="w-full text-sm border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-gray-300 dark:bg-gray-700 dark:text-gray-100"
  />
</div>
```

**저장 시 tags 포함:**
```tsx
// 생성
await supabase.from('posts').insert({
  ...기존필드,
  tags: editTags,
})

// 수정
await supabase.from('posts').update({
  ...기존필드,
  tags: editTags,
}).eq('id', editPost.id)
```

### 6.4 태그 필터 UI

이슈 페이지 상단 기존 필터 pills 아래 태그 pills 추가:

```tsx
{/* 사용 중인 태그 목록 — 클릭 시 해당 태그 필터 */}
{allTags.length > 0 && (
  <div className="flex flex-wrap gap-1.5 mb-4">
    <button
      onClick={() => setTagFilter(null)}
      className={cn('px-2.5 py-1 rounded-full text-xs border transition-all',
        tagFilter === null ? 'bg-gray-900 text-white border-transparent' : 'border-gray-200 text-gray-500 hover:border-gray-400'
      )}
    >
      모든 태그
    </button>
    {allTags.map(tag => (
      <button key={tag}
        onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
        className={cn('px-2.5 py-1 rounded-full text-xs border transition-all',
          tagFilter === tag ? 'bg-gray-800 text-white border-transparent' : 'border-gray-200 text-gray-500 dark:border-gray-600 hover:border-gray-400'
        )}
      >
        #{tag}
      </button>
    ))}
  </div>
)}
```

```tsx
// allTags: 현재 프로젝트의 모든 posts에서 고유 태그 추출
const allTags = useMemo(
  () => [...new Set(posts.flatMap(p => p.tags ?? []))].sort(),
  [posts]
)

// tagFilter state
const [tagFilter, setTagFilter] = useState<string | null>(null)

// filteredPosts에 태그 필터 추가
const filteredPosts = useMemo(() => {
  let list = posts
  // 기존 type/status 필터 적용...
  if (tagFilter) list = list.filter(p => p.tags?.includes(tagFilter))
  return list
}, [posts, tagFilter, /* 기존 의존성 */])
```

---

## 7. 파일별 변경 요약

| 파일 | 변경 항목 수 | 주요 변경 |
|------|------------|-----------|
| `src/app/(main)/overview/page.tsx` | A-1~A-7 (7개) | ViewType 확장, 탭 3개, filteredPosts 분기 |
| `src/app/(main)/crm/contacts/[id]/page.tsx` | B-1~B-6 (6개) | TaskModal 연동, 완료 취소선 |
| `src/app/(main)/report/page.tsx` | C-1 (1개) | 이슈/기록 stat 카드 3개 |
| `src/components/ui/MarkdownEditor.tsx` | D-1~D-4 (4개) | 표 팝오버 |
| `src/types/index.ts` | E-2 (1개) | Post.tags 필드 |
| `src/app/(main)/projects/[id]/issues/page.tsx` | E-3~E-5 (3개) | 태그 입력 + 필터 |
| Supabase SQL | E-1 (1개) | ALTER TABLE posts ADD COLUMN tags |

**총 22개 구현 항목**

---

## 8. 구현 순서

```
① A (overview 탭 분리)      — 가장 임팩트 크고 DB 변경 없음
② B (CRM 태스크 연동)       — 독립적, 빠름
③ C (리포트 stat 카드)      — weeklyPosts 이미 있어 stat 계산만 추가
④ D (tiptap 표 팝오버)      — MarkdownEditor.tsx 단독 수정
⑤ E (태그 기능)             — DB ALTER TABLE 선행 후 타입→UI 순서로
```

---

## 9. 주의사항

- **B**: `TaskModal` props가 `task + onClose` 패턴인지 `projects/[id]/page.tsx` line 412 확인 후 import
- **D**: `useRef`를 `ToolBtn` 외부 wrapper `div`에 붙여야 외부 클릭 감지 정확함; `ToolBtn` 컴포넌트에 ref forwarding 불필요
- **E**: `posts` SELECT 쿼리에 `tags` 컬럼이 누락되면 `undefined` 반환 → `p.tags ?? []` 방어 코드 필수
- **E**: Supabase `DEFAULT '{}'` 설정으로 기존 rows는 빈 배열 자동 초기화됨 — 마이그레이션 스크립트 불필요
