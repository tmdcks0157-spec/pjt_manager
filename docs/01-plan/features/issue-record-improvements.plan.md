# Plan: issue-record-improvements — 이슈&기록 기능 강화 묶음

> 작성일: 2026-06-24

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 이슈와 기록이 동일 탭에 섞여 있어 분리 조회 불가, 연락처의 연결된 태스크는 클릭해도 아무 동작 없음, 테이블은 3×3 고정, 이슈에 태그가 없어 분류 불가, 리포트에 이슈/기록 통계 누락 |
| **Solution** | 전체현황 이슈 뷰를 이슈/기록 탭으로 분리, CRM 태스크 클릭 → TaskModal 연동 + 완료 취소선, tiptap 테이블 커스텀 크기 입력, posts 테이블에 tags 컬럼 추가 + 태그 필터 UI, 주간리포트에 이슈/기록 통계 섹션 추가 |
| **Function UX Effect** | 이슈/기록 독립 탭으로 원하는 유형만 즉시 필터, 연락처 화면에서 태스크 직접 열고 완료 여부 한눈에 확인, 대형 표 자유롭게 삽입, 이슈에 태그 붙여 빠른 분류, 리포트에서 이슈/기록 현황까지 주간 리뷰 가능 |
| **Core Value** | 파편화된 기능들을 연결해 이슈·기록·태스크·CRM·리포트가 유기적으로 연결된 통합 워크플로우 완성 |

---

## 1. 구현 범위 (5개 Sub-feature)

| # | Sub-feature | 난이도 | DB 변경 | 우선순위 |
|---|-------------|--------|---------|---------|
| A | 이슈&기록 분리 (overview 탭 분리) | 낮음 | 없음 | 1 |
| B | 연락처 연결된 태스크 — 클릭 모달 + 완료 취소선 | 낮음 | 없음 | 2 |
| C | 리포트 이슈/기록 통계 추가 | 중간 | 없음 | 3 |
| D | tiptap 표 커스텀 크기 입력 | 낮음 | 없음 | 4 |
| E | 이슈/기록 태그 기능 | 중간 | 있음 (posts.tags) | 5 |

---

## 2. 현황 분석

### A — 이슈&기록 분리

- `overview/page.tsx` line 24: `type IssueFilterType = 'all' | 'open' | 'closed' | 'note'`
- 현재 issues 뷰에서 `issueFilter === 'note'`로 기록만 거르는 방식
- **문제**: 이슈/기록이 같은 탭에 혼재 → 기록만 보려면 필터 드롭다운 사용해야 함

### B — 연락처 연결된 태스크

- `crm/contacts/[id]/page.tsx` line 232-245: tasks 탭 이미 있음
- 태스크 카드가 단순 `div` (클릭 이벤트 없음, line 241)
- 완료 상태 표시 없음 (`task.archived` 또는 완료 컬럼 체크 미구현)

### C — 리포트 이슈/기록 통계

- `report/page.tsx`: 태스크 완료/생성 BarChart만 있음
- posts 테이블 쿼리 없음 → 이슈/기록 카운트 섹션 없음

### D — tiptap 표 커스텀 크기

- `MarkdownEditor.tsx`: 툴바의 표 버튼이 `insertTable({ rows: 3, cols: 3 })` 고정 호출
- 3행 3열 이상 생성 불가

### E — 태그 기능

- `Post` 인터페이스 (`types/index.ts` line 75-85): `tags` 필드 없음
- `posts` Supabase 테이블: `tags TEXT[]` 컬럼 없음
- `Task`는 `tags: string[]` 이미 있음 (line 35)

---

## 3. 상세 설계

### A — 이슈&기록 분리

**현재 뷰 구조:**
```
전체현황 → [태스크 탭] [이슈&기록 탭]
이슈&기록 탭 내부: 필터 드롭다운 (전체/열림/닫힘/기록)
```

**변경 후:**
```
전체현황 → [태스크 탭] [이슈 탭] [기록 탭]
이슈 탭: 필터 (열림/닫힘/전체)
기록 탭: 필터 (열림/닫힘/전체) — 기록은 열림/닫힘 개념 동일 유지
```

**변경 사항:**
- `ViewType = 'tasks' | 'issues'` → `'tasks' | 'issues' | 'notes'`
- `IssueFilterType`에서 `'note'` 제거 → `'all' | 'open' | 'closed'`
- 탭 헤더에 이슈/기록 뱃지 카운트 표시
- 이슈 탭: `type === 'issue'` 필터
- 기록 탭: `type === 'note'` 필터

### B — 연락처 연결된 태스크

**변경 사항 (`crm/contacts/[id]/page.tsx`):**

1. TaskModal import 추가
2. `selectedTask` state 추가 (`Task | null`)
3. 태스크 카드 클릭 → `setSelectedTask(task)` → TaskModal 열기
4. 완료 판단 로직: `task.checklist_items`가 있으면 모두 완료 여부 / 또는 `task.status`가 완료 컬럼 id인지 확인
   - 간단하게: `task.archived === true` 또는 컬럼명이 '완료'/'done'/'Done'인 경우 취소선
   - **실용적 방법**: columns 데이터를 함께 가져와서 마지막 컬럼(완료 컬럼)의 id와 `task.status` 비교
5. 취소선: `task.status === doneColumnId ? 'line-through text-gray-400' : ''`

```tsx
// 태스크 카드 변경
<div 
  key={task.id} 
  onClick={() => setSelectedTask(task)}
  className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
>
  <CheckCircle2 className={cn('w-4 h-4 shrink-0', isDone ? 'text-green-500' : 'text-gray-300')} />
  <p className={cn('flex-1 text-sm', isDone ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-200')}>
    {task.title}
  </p>
  <ExternalLink className="w-3.5 h-3.5 text-gray-400 shrink-0" />
</div>
{selectedTask && <TaskModal task={selectedTask} onClose={() => setSelectedTask(null)} />}
```

### C — 리포트 이슈/기록 통계

**추가 섹션 (report/page.tsx):**

```
주간 이슈 & 기록 요약
┌──────────────────────────────────────────────────┐
│  이슈 등록: 3건   이슈 닫힘: 2건   미해결: 1건    │
│  기록 작성: 5건                                   │
└──────────────────────────────────────────────────┘
```

**쿼리 추가:**
```ts
// 이번 주 생성된 이슈
const { data: weekIssues } = useQuery({
  queryKey: ['weekly-issues', start.toISOString()],
  queryFn: async () => supabase.from('posts')
    .select('*')
    .eq('type', 'issue')
    .gte('created_at', start.toISOString())
    .lte('created_at', end.toISOString())
})

// 이번 주 작성된 기록
const { data: weekNotes } = useQuery(...)
```

**표시:**
- 이슈: 등록 N건 / 닫힘 N건 / 미해결 N건
- 기록: 작성 N건

### D — tiptap 표 커스텀 크기 입력

**현재 코드 (`MarkdownEditor.tsx`):**
```ts
// 툴바 표 버튼
onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
```

**변경 방법 — 인라인 팝오버:**
```
표 버튼 클릭 → 작은 팝오버 표시
┌─────────────────────┐
│ 행: [3↑↓]  열: [3↑↓] │
│ [표 삽입]            │
└─────────────────────┘
```

**구현:**
- `showTablePicker` boolean state
- 팝오버에서 행/열 number input (최대 10×10)
- 확인 클릭 → `insertTable({ rows, cols, withHeaderRow: true })`
- 외부 클릭 시 닫힘 (`onBlur` 또는 `useEffect` + `mousedown`)

### E — 이슈/기록 태그 기능

**DB 변경 (Supabase SQL):**
```sql
ALTER TABLE posts ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
```

**타입 변경 (`types/index.ts`):**
```ts
export interface Post {
  // 기존 필드들...
  tags: string[]  // 추가
}
```

**UI — 이슈 모달 태그 입력:**
- 태스크의 기존 태그 UI 패턴 재사용 (Task.tags 방식)
- 입력창에서 엔터/쉼표로 태그 추가, X 버튼으로 삭제
- 칩(pill) 형태 표시

**필터 UI (이슈/기록 탭 상단):**
- 자주 쓰는 태그 pill로 빠른 필터
- 선택 시 해당 태그가 있는 이슈/기록만 표시

---

## 4. 파일 변경 계획

| 파일 | Sub | 변경 유형 | 내용 |
|------|-----|-----------|------|
| `src/app/(main)/overview/page.tsx` | A | 수정 | ViewType 확장, 이슈/기록 탭 분리 |
| `src/app/(main)/crm/contacts/[id]/page.tsx` | B | 수정 | 태스크 클릭 → TaskModal, 완료 취소선 |
| `src/app/(main)/report/page.tsx` | C | 수정 | 이슈/기록 주간 쿼리 + 통계 섹션 |
| `src/components/ui/MarkdownEditor.tsx` | D | 수정 | 표 삽입 팝오버 (행×열 선택) |
| Supabase SQL (직접 실행) | E | DB | `ALTER TABLE posts ADD COLUMN tags TEXT[]` |
| `src/types/index.ts` | E | 수정 | Post 인터페이스에 `tags: string[]` 추가 |
| `src/app/(main)/projects/[id]/issues/page.tsx` | E | 수정 | 태그 입력 UI + 태그 필터 |

---

## 5. 구현 순서 (권장)

```
A → B → C → D → E
(DB 없음) → (DB 없음) → (DB 없음) → (DB 없음) → (DB 변경)
```

E(태그)는 DB 변경이 필요하므로 마지막에 구현.

---

## 6. 미포함 범위

- 태그 자동완성 (추후)
- 이슈 담당자 멀티셀렉트 (multi-assignee 별도 Plan 문서 있음)
- tiptap 이미지 첨부 (별도 파일첨부 기능으로 분리)
- 기록의 공유/내보내기
