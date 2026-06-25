# Design: meeting-notes

> Plan 참조: `docs/01-plan/features/meeting-notes.plan.md`
> 작성일: 2026-06-25

---

## 1. 파일 구조

```
src/
├─ app/(main)/
│   ├─ layout.tsx                        ← NAV_ITEMS에 /meetings 추가
│   └─ meetings/
│       ├─ page.tsx                      ← 목록 (미니캘린더 + 리스트)
│       └─ [id]/
│           └─ page.tsx                  ← 상세 (3열 레이아웃)
│
├─ components/meetings/
│   ├─ MeetingMiniCalendar.tsx           ← 달력 + dot 표시
│   ├─ MeetingListItem.tsx               ← 목록 카드
│   ├─ MeetingTimer.tsx                  ← 카운트업 타이머
│   ├─ MeetingAgenda.tsx                 ← 안건 체크리스트
│   ├─ MeetingNotes.tsx                  ← 마크다운 편집/미리보기
│   ├─ MeetingAttendees.tsx              ← 참석자 (CRM 자동완성)
│   └─ ActionItemPanel.tsx               ← 액션 아이템 패널
│
└─ supabase/migrations/
    └─ 0007_meeting_notes.sql
```

---

## 2. DB 마이그레이션

### `supabase/migrations/0007_meeting_notes.sql`

```sql
-- meetings
CREATE TABLE public.meetings (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title            TEXT        NOT NULL DEFAULT '제목 없는 회의',
  date             TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_minutes INT         DEFAULT NULL,
  status           TEXT        NOT NULL DEFAULT 'scheduled'
                               CHECK (status IN ('scheduled','in_progress','completed')),
  agenda           JSONB       NOT NULL DEFAULT '[]',
  notes            TEXT        NOT NULL DEFAULT '',
  project_id       UUID        DEFAULT NULL,
  started_at       TIMESTAMPTZ DEFAULT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- meeting_attendees
CREATE TABLE public.meeting_attendees (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id   UUID        NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  contact_id   UUID        DEFAULT NULL,
  name         TEXT        NOT NULL,
  email        TEXT        DEFAULT NULL,
  role         TEXT        NOT NULL DEFAULT 'attendee'
                           CHECK (role IN ('organizer','attendee')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- action_items
CREATE TABLE public.action_items (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id           UUID        NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id              UUID        NOT NULL,
  text                 TEXT        NOT NULL,
  assignee_name        TEXT        DEFAULT NULL,
  assignee_contact_id  UUID        DEFAULT NULL,
  due_date             DATE        DEFAULT NULL,
  status               TEXT        NOT NULL DEFAULT 'open'
                                   CHECK (status IN ('open','done')),
  exported_task_id     TEXT        DEFAULT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_meetings_user_id     ON public.meetings(user_id);
CREATE INDEX idx_meetings_date        ON public.meetings(date);
CREATE INDEX idx_action_items_meeting ON public.action_items(meeting_id);

-- RLS
ALTER TABLE public.meetings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_items      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meetings_owner"   ON public.meetings
  USING (auth.uid() = user_id);
CREATE POLICY "attendees_owner"  ON public.meeting_attendees
  USING (EXISTS (SELECT 1 FROM public.meetings m WHERE m.id = meeting_id AND m.user_id = auth.uid()));
CREATE POLICY "action_items_owner" ON public.action_items
  USING (auth.uid() = user_id);

-- updated_at 트리거 (기존 패턴)
CREATE TRIGGER meetings_updated_at
  BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER action_items_updated_at
  BEFORE UPDATE ON public.action_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## 3. 타입 정의 (`src/types/index.ts` 추가)

```typescript
export interface AgendaItem {
  id: string
  text: string
  done: boolean
}

export interface Meeting {
  id: string
  user_id: string
  title: string
  date: string           // ISO timestamp
  duration_minutes: number | null
  status: 'scheduled' | 'in_progress' | 'completed'
  agenda: AgendaItem[]
  notes: string          // 마크다운 원문
  project_id: string | null
  started_at: string | null
  created_at: string
  updated_at: string
  attendees?: MeetingAttendee[]
  action_items?: ActionItem[]
  project?: { id: string; name: string; color: string } | null  // join
}

export interface MeetingAttendee {
  id: string
  meeting_id: string
  contact_id: string | null
  name: string
  email: string | null
  role: 'organizer' | 'attendee'
  created_at: string
}

export interface ActionItem {
  id: string
  meeting_id: string
  user_id: string
  text: string
  assignee_name: string | null
  assignee_contact_id: string | null
  due_date: string | null
  status: 'open' | 'done'
  exported_task_id: string | null
  created_at: string
  updated_at: string
}
```

---

## 4. 사이드바 연동 (`src/app/(main)/layout.tsx`)

```typescript
// NAV_ITEMS 배열에 추가
import { ClipboardList } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/today',     label: '오늘',       icon: Sun },
  { href: '/dashboard', label: '프로젝트',   icon: LayoutDashboard },
  { href: '/crm',       label: '연락처',     icon: Users },
  { href: '/meetings',  label: '회의록',     icon: ClipboardList },   // ← 추가
  { href: '/overview',  label: '전체 현황',  icon: LayoutGrid },
  { href: '/calendar',  label: '캘린더',     icon: Calendar },
  { href: '/report',    label: '주간 리포트', icon: BarChart2 },
]
```

---

## 5. 컴포넌트 상세 설계

### 5.1 목록 페이지 `src/app/(main)/meetings/page.tsx`

```typescript
// 쿼리 — project join으로 name/color 포함
const { data: meetings } = useQuery<Meeting[]>({
  queryKey: ['meetings'],
  queryFn: async () => {
    const { data } = await supabase
      .from('meetings')
      .select('*, attendees:meeting_attendees(*), action_items(*), project:projects(id, name, color)')
      .order('date', { ascending: false })
    return data ?? []
  }
})

// 상태
const [selectedDate, setSelectedDate] = useState<string | null>(null)  // YYYY-MM-DD

// 필터: selectedDate가 있으면 해당 날짜 회의만
const filtered = selectedDate
  ? meetings.filter(m => m.date.startsWith(selectedDate))
  : meetings

// 그룹핑: 오늘 / 이번 주 / 지난 주 / 이번 달 / 이전
function groupMeetings(meetings: Meeting[]) { ... }
```

**레이아웃:**
```tsx
<div className="flex h-full">
  {/* 왼쪽: 미니 캘린더 */}
  <div className="w-64 shrink-0 border-r dark:border-gray-700 p-4">
    <MeetingMiniCalendar
      meetings={meetings}
      selectedDate={selectedDate}
      onSelectDate={setSelectedDate}
    />
    {/* 이번 달 통계 */}
    <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs">
      <p>이번 달 {monthCount}회 · {monthHours}시간</p>
    </div>
  </div>

  {/* 오른쪽: 리스트 */}
  <div className="flex-1 overflow-y-auto p-6">
    <div className="flex justify-between mb-6">
      <h1>회의록</h1>
      <button onClick={handleCreate}>[+ 새 회의]</button>
    </div>
    {Object.entries(grouped).map(([label, items]) => (
      <section key={label}>
        <h2>{label}</h2>
        {items.map(m => <MeetingListItem key={m.id} meeting={m} />)}
      </section>
    ))}
  </div>
</div>
```

---

### 5.2 `MeetingMiniCalendar.tsx`

```typescript
interface Props {
  meetings: Meeting[]
  selectedDate: string | null
  onSelectDate: (date: string | null) => void
}

// 해당 월의 회의 있는 날짜 set
const datesWithMeetings = useMemo(() =>
  new Set(meetings.map(m => m.date.slice(0, 10))),
  [meetings]
)

// date-fns 사용: startOfMonth, eachDayOfInterval, endOfMonth
// 날짜 셀: dot 표시 + 선택 시 강조
// 이전/다음 월 이동
```

**렌더링 패턴:**
```tsx
<div className="text-xs">
  {/* 헤더: < 2026년 6월 > */}
  <div className="grid grid-cols-7 gap-0.5 mt-2">
    {days.map(day => (
      <button key={day}
        onClick={() => onSelectDate(isSameDay(day, selectedDate) ? null : format(day, 'yyyy-MM-dd'))}
        className={cn(
          "h-7 w-7 rounded-full text-center text-xs relative",
          isToday(day) && "font-bold text-blue-600",
          isSameDay(day, new Date(selectedDate ?? '')) && "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900",
        )}>
        {format(day, 'd')}
        {datesWithMeetings.has(format(day, 'yyyy-MM-dd')) && (
          <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-400" />
        )}
      </button>
    ))}
  </div>
</div>
```

---

### 5.3 `MeetingListItem.tsx`

**UX 확정:** 카드 하단에 시간+소요시간 / 프로젝트 연결 여부를 한 줄로 표시.
- 연결됨: 프로젝트 color dot + 이름 (색상은 프로젝트 color 그대로)
- 미연결: 빈 원(○) + "프로젝트 없음" (회색 흐림)

```
┌──────────────────────────────────────────────┐
│ Q1 전략 회의                        🟡 진행중 │
│ 14:00 · 45분              ● pjt-manager      │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ 팀 스탠드업                          ✅ 완료  │
│ 09:00 · 15분              ○ 프로젝트 없음    │
└──────────────────────────────────────────────┘
```

```typescript
interface Props {
  meeting: Meeting
}

const STATUS_BADGE = {
  scheduled:   { label: '예정',   className: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400' },
  in_progress: { label: '진행중', className: 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-500' },
  completed:   { label: '완료',   className: 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' },
}
```

**렌더링:**
```tsx
<Link href={`/meetings/${meeting.id}`}
  className="block p-3.5 rounded-xl border border-gray-200 dark:border-gray-700
             hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm
             bg-white dark:bg-gray-800 transition-all">

  {/* 1행: 제목 + 상태 뱃지 */}
  <div className="flex items-start justify-between gap-2 mb-2">
    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
      {meeting.title}
    </p>
    <span className={cn('shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium',
      STATUS_BADGE[meeting.status].className)}>
      {STATUS_BADGE[meeting.status].label}
    </span>
  </div>

  {/* 2행: 시간+소요 / 프로젝트 */}
  <div className="flex items-center justify-between text-xs text-gray-400">
    {/* 왼쪽: 시간 · 소요시간 */}
    <span>
      {format(new Date(meeting.date), 'HH:mm')}
      {meeting.duration_minutes && ` · ${meeting.duration_minutes}분`}
    </span>

    {/* 오른쪽: 프로젝트 연결 여부 */}
    {meeting.project ? (
      <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
        {/* 프로젝트 color dot */}
        <span className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: meeting.project.color }} />
        <span className="truncate max-w-[120px]">{meeting.project.name}</span>
      </span>
    ) : (
      <span className="flex items-center gap-1 text-gray-300 dark:text-gray-600">
        <span className="w-2 h-2 rounded-full border border-gray-300 dark:border-gray-600 shrink-0" />
        프로젝트 없음
      </span>
    )}
  </div>
</Link>
```

---

### 5.4 상세 페이지 `src/app/(main)/meetings/[id]/page.tsx`

```typescript
// 쿼리
const { data: meeting } = useQuery<Meeting>({
  queryKey: ['meeting', id],
  queryFn: async () => {
    const { data } = await supabase
      .from('meetings')
      .select('*, attendees:meeting_attendees(*), action_items(*)')
      .eq('id', id).single()
    return data
  }
})

// 이전 회의 미완료 액션 아이템 (같은 project_id)
const { data: pendingFromPrev } = useQuery<ActionItem[]>({
  queryKey: ['pending-actions', meeting?.project_id],
  enabled: !!meeting?.project_id,
  queryFn: async () => {
    const { data } = await supabase
      .from('action_items')
      .select('*, meeting:meetings(title, date)')
      .eq('status', 'open')
      .neq('meeting_id', id)
      .order('created_at', { ascending: false })
      .limit(10)
    return data ?? []
  }
})

// 상태
const [showCarryoverBanner, setShowCarryoverBanner] = useState(
  (pendingFromPrev?.length ?? 0) > 0
)
```

**레이아웃:**
```tsx
<div className="flex flex-col h-screen">
  {/* 상단 헤더 + 타이머 */}
  <div className="flex items-center gap-4 px-6 py-3 border-b dark:border-gray-700">
    <Link href="/meetings">◀ 목록</Link>
    <input value={title} onChange={...} className="flex-1 font-bold text-lg bg-transparent" />
    <MeetingTimer meeting={meeting} onUpdate={handleTimerUpdate} />
  </div>

  {/* 3열 본문 */}
  <div className="flex flex-1 overflow-hidden">
    {/* 왼쪽 22% */}
    <div className="w-56 shrink-0 border-r dark:border-gray-700 overflow-y-auto p-4 space-y-4">
      <MeetingMiniCalendar meetings={allMeetings} selectedDate={...} onSelectDate={...} />
      <MeetingInfo meeting={meeting} onUpdate={handleUpdate} />
      <MeetingAttendees meeting={meeting} />
    </div>

    {/* 중앙 48% */}
    <div className="flex-1 flex flex-col overflow-hidden border-r dark:border-gray-700">
      <MeetingAgenda meeting={meeting} onUpdate={handleUpdate} />
      <MeetingNotes meeting={meeting} onUpdate={handleNotesUpdate} />
    </div>

    {/* 오른쪽 30% */}
    <div className="w-80 shrink-0 overflow-y-auto">
      <ActionItemPanel
        meetingId={id}
        actionItems={meeting.action_items ?? []}
        pendingFromPrev={pendingFromPrev}
        projectId={meeting.project_id}
      />
    </div>
  </div>
</div>
```

---

### 5.5 `MeetingTimer.tsx`

```typescript
interface Props {
  meeting: Meeting
  onUpdate: (patch: Partial<Meeting>) => void
}

// 로컬 상태: elapsed 초
const [elapsed, setElapsed] = useState(() => {
  if (meeting.started_at) {
    return Math.floor((Date.now() - new Date(meeting.started_at).getTime()) / 1000)
  }
  return 0
})

// interval: in_progress 일 때만 작동
useEffect(() => {
  if (meeting.status !== 'in_progress') return
  const id = setInterval(() => setElapsed(e => e + 1), 1000)
  return () => clearInterval(id)
}, [meeting.status])

function formatTime(s: number) {
  const h = Math.floor(s / 3600).toString().padStart(2, '0')
  const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0')
  const sec = (s % 60).toString().padStart(2, '0')
  return h === '00' ? `${m}:${sec}` : `${h}:${m}:${sec}`
}

async function handleStart() {
  const now = new Date().toISOString()
  await supabase.from('meetings').update({ status: 'in_progress', started_at: now }).eq('id', meeting.id)
  onUpdate({ status: 'in_progress', started_at: now })
}

async function handleStop() {
  const duration = Math.round(elapsed / 60)
  await supabase.from('meetings').update({ status: 'completed', duration_minutes: duration }).eq('id', meeting.id)
  onUpdate({ status: 'completed', duration_minutes: duration })
}
```

**렌더링:**
```tsx
{meeting.status === 'scheduled' && (
  <button onClick={handleStart} className="flex items-center gap-2 px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm">
    <Play size={14} /> 회의 시작
  </button>
)}
{meeting.status === 'in_progress' && (
  <div className="flex items-center gap-3">
    <span className="font-mono text-sm text-green-600 dark:text-green-400">{formatTime(elapsed)}</span>
    <button onClick={handleStop} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs">
      <Square size={12} /> 종료
    </button>
  </div>
)}
{meeting.status === 'completed' && (
  <span className="text-xs text-gray-500">{meeting.duration_minutes}분 완료</span>
)}
```

---

### 5.6 `MeetingAgenda.tsx`

```typescript
interface Props {
  meeting: Meeting
  onUpdate: (patch: Partial<Meeting>) => void
}

// agenda: AgendaItem[] — JSONB에서 파싱됨
// 체크 토글: item.done = !item.done → 전체 agenda 배열 update
// 추가: [...agenda, { id: uuid(), text: '', done: false }]
// 삭제: agenda.filter(i => i.id !== id)

async function handleToggle(itemId: string) {
  const next = meeting.agenda.map(i =>
    i.id === itemId ? { ...i, done: !i.done } : i
  )
  await supabase.from('meetings').update({ agenda: next }).eq('id', meeting.id)
  onUpdate({ agenda: next })
}
```

**렌더링:**
```tsx
<div className="border-b dark:border-gray-700 px-4 py-3">
  <div className="flex items-center gap-2 mb-2">
    <ClipboardList size={13} className="text-gray-400" />
    <span className="text-xs font-medium text-gray-500">안건</span>
    <button onClick={handleAdd} className="ml-auto text-xs text-gray-400 hover:text-gray-600">+ 추가</button>
  </div>
  <div className="flex flex-wrap gap-2">
    {meeting.agenda.map(item => (
      <button key={item.id} onClick={() => handleToggle(item.id)}
        className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors",
          item.done
            ? "bg-green-50 border-green-200 text-green-700 line-through dark:bg-green-900/20 dark:border-green-700 dark:text-green-400"
            : "bg-white border-gray-200 text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300"
        )}>
        {item.done ? <CheckSquare size={10} /> : <Square size={10} />}
        {item.text}
      </button>
    ))}
  </div>
</div>
```

---

### 5.7 `MeetingNotes.tsx`

```typescript
interface Props {
  meeting: Meeting
  onUpdate: (patch: Partial<Meeting>) => void
}

// 패키지: react-markdown + remark-gfm + rehype-sanitize (모두 설치됨)
const [tab, setTab] = useState<'edit' | 'preview'>('edit')
const [notes, setNotes] = useState(meeting.notes)

// 자동 저장: 1초 debounce
useEffect(() => {
  const timer = setTimeout(async () => {
    await supabase.from('meetings').update({ notes }).eq('id', meeting.id)
    onUpdate({ notes })
  }, 1000)
  return () => clearTimeout(timer)
}, [notes])
```

**렌더링:**
```tsx
<div className="flex-1 flex flex-col overflow-hidden p-4">
  {/* 탭 토글 */}
  <div className="flex gap-1 mb-3">
    {(['edit', 'preview'] as const).map(t => (
      <button key={t} onClick={() => setTab(t)}
        className={cn("px-3 py-1 text-xs rounded-md transition-colors",
          tab === t ? "bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900"
                    : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
        )}>
        {t === 'edit' ? '편집' : '미리보기'}
      </button>
    ))}
  </div>

  {tab === 'edit' ? (
    <textarea
      value={notes}
      onChange={e => setNotes(e.target.value)}
      placeholder="마크다운으로 회의 내용을 기록하세요..."
      className="flex-1 resize-none bg-transparent text-sm text-gray-800 dark:text-gray-200
                 placeholder:text-gray-300 dark:placeholder:text-gray-600 focus:outline-none
                 font-mono leading-relaxed"
    />
  ) : (
    <div className="flex-1 overflow-y-auto prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {notes || '*아직 작성된 내용이 없습니다.*'}
      </ReactMarkdown>
    </div>
  )}
</div>
```

---

### 5.8 `MeetingAttendees.tsx`

```typescript
interface Props {
  meeting: Meeting
}

// useContacts() 훅 재사용 (기존 CRM 훅)
const { data: contacts = [] } = useContacts()

// 자동완성: 입력값으로 contacts 필터
// 선택 시 meeting_attendees에 INSERT
// 자유 입력: Enter로 이름만 추가
```

---

### 5.9 `ActionItemPanel.tsx`

```typescript
interface Props {
  meetingId: string
  actionItems: ActionItem[]
  pendingFromPrev: ActionItem[]
  projectId: string | null
  projects: { id: string; name: string; color: string }[]  // picker용 전체 프로젝트
}

// 이월 배너: pendingFromPrev.length > 0 일 때
{showCarryoverBanner && pendingFromPrev.length > 0 && (
  <div className="mx-3 mt-3 p-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg text-xs">
    <p className="text-amber-700 dark:text-amber-400 font-medium">
      이전 회의 미완료 {pendingFromPrev.length}건
    </p>
    <div className="mt-1 space-y-1">
      {pendingFromPrev.slice(0, 3).map(a => (
        <p key={a.id} className="text-amber-600 dark:text-amber-500 truncate">· {a.text}</p>
      ))}
    </div>
    <div className="flex gap-2 mt-2">
      <button onClick={handleCarryover} className="px-2 py-1 bg-amber-600 text-white rounded text-xs">이월하기</button>
      <button onClick={() => setShowCarryoverBanner(false)} className="text-amber-500 text-xs">무시</button>
    </div>
  </div>
)}

// 이월하기: pendingFromPrev 복사하여 현재 meeting의 action_items에 INSERT
async function handleCarryover() {
  const userId = await requireUserId()
  const copies = pendingFromPrev.map(a => ({
    meeting_id: meetingId,
    user_id: userId,
    text: a.text,
    assignee_name: a.assignee_name,
    assignee_contact_id: a.assignee_contact_id,
    due_date: a.due_date,
    status: 'open' as const,
  }))
  await supabase.from('action_items').insert(copies)
  queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] })
  setShowCarryoverBanner(false)
}

// 태스크 내보내기 — 프로젝트 연결 여부에 따라 분기
// - 연결됨: 바로 내보내기
// - 미연결: 프로젝트 선택 드롭다운 표시 후 내보내기
const [exportPickerItemId, setExportPickerItemId] = useState<string | null>(null)

async function handleExport(item: ActionItem) {
  let targetProjectId = projectId

  if (!targetProjectId) {
    // 프로젝트 미연결 → picker 표시
    setExportPickerItemId(item.id)
    return
  }
  await doExport(item, targetProjectId)
}

async function handleExportWithProject(item: ActionItem, selectedProjectId: string) {
  setExportPickerItemId(null)
  await doExport(item, selectedProjectId)
}

async function doExport(item: ActionItem, targetProjectId: string) {
  const userId = await requireUserId()
  const { data: cols } = await supabase
    .from('columns').select('id').eq('project_id', targetProjectId).order('order').limit(1)
  const columnId = cols?.[0]?.id
  if (!columnId) return

  const { data: task } = await supabase.from('tasks').insert({
    title: item.text,
    project_id: targetProjectId,
    user_id: userId,
    status: columnId,
    priority: 'normal',
    due_date: item.due_date ? new Date(item.due_date).toISOString() : null,
    assignee_name: item.assignee_name,
    description: '', notes: '', tags: [], order: 0, archived: false,
  }).select().single()

  if (task) {
    await supabase.from('action_items').update({ exported_task_id: task.id }).eq('id', item.id)
    queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] })
  }
}
```

**액션 아이템 폼:**
```tsx
// 인라인 추가 폼
<div className="flex gap-1.5 items-start">
  <input value={newText} placeholder="액션 아이템..." className="flex-1 text-xs" />
  <input value={newAssignee} placeholder="담당자" className="w-20 text-xs" />
  <input type="date" value={newDueDate} className="w-24 text-xs" />
  <button onClick={handleAdd}>추가</button>
</div>

// 아이템 행
{actionItems.map(item => (
  <div key={item.id} className="flex items-start gap-2 py-2 border-b dark:border-gray-700">
    <button onClick={() => handleToggle(item)} className="mt-0.5 shrink-0">
      {item.status === 'done' ? <CheckSquare size={14} className="text-green-500" /> : <Square size={14} className="text-gray-400" />}
    </button>
    <div className="flex-1 min-w-0">
      <p className={cn("text-xs", item.status === 'done' && "line-through text-gray-400")}>{item.text}</p>
      <p className="text-[10px] text-gray-400 mt-0.5">
        {item.assignee_name} {item.due_date && `· ${item.due_date}`}
      </p>
    </div>
    {/* 내보내기 버튼: 프로젝트 연결 여부와 무관하게 항상 표시 */}
    {!item.exported_task_id && (
      <div className="relative shrink-0">
        <button onClick={() => handleExport(item)} title="태스크로 내보내기"
          className="text-gray-300 hover:text-blue-500">
          <ExternalLink size={12} />
        </button>

        {/* 프로젝트 미연결 시 picker 드롭다운 */}
        {exportPickerItemId === item.id && (
          <div className="absolute right-0 top-5 z-10 w-44 bg-white dark:bg-gray-800
                          border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1">
            <p className="px-3 py-1.5 text-[10px] text-gray-400 font-medium">프로젝트 선택</p>
            {projects.map(p => (
              <button key={p.id}
                onClick={() => handleExportWithProject(item, p.id)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs
                           text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                <span className="truncate">{p.name}</span>
              </button>
            ))}
            <button onClick={() => setExportPickerItemId(null)}
              className="w-full px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 text-left">
              취소
            </button>
          </div>
        )}
      </div>
    )}
    {item.exported_task_id && (
      <span title="태스크로 내보냄" className="text-green-400 shrink-0"><Check size={12} /></span>
    )}
  </div>
))}
```

---

## 6. 데이터 플로우

```
목록 페이지
  useQuery(['meetings'])
    → supabase.meetings.select('*, attendees(*), action_items(*)')
    → MeetingMiniCalendar (dot 표시)
    → MeetingListItem × N

상세 페이지
  useQuery(['meeting', id])
    → supabase.meetings.select('*, attendees(*), action_items(*)')
    → 왼쪽: MeetingMiniCalendar + 기본 정보 + 참석자
    → 중앙: MeetingAgenda + MeetingNotes (debounce auto-save)
    → 오른쪽: ActionItemPanel (이월 배너 + 아이템 목록)

  useQuery(['pending-actions', project_id])
    → supabase.action_items.select().eq('status','open').neq('meeting_id', id)
    → ActionItemPanel 이월 배너

뮤테이션
  - 회의 시작/종료: meetings.update(status, started_at, duration_minutes)
  - 안건 체크: meetings.update(agenda[])
  - 메모 저장: meetings.update(notes) [debounce 1s]
  - 액션 추가: action_items.insert()
  - 액션 완료: action_items.update(status)
  - 이월: action_items.insert(copies)
  - 태스크 내보내기 (프로젝트 연결): tasks.insert() + action_items.update(exported_task_id)
  - 태스크 내보내기 (미연결): picker → 선택 후 동일 로직

목록 페이지 추가 데이터
  useQuery(['projects'])  ← ActionItemPanel picker용 (상세 페이지에서 로드)
  meetings select에 project:projects(id,name,color) join → MeetingListItem 연결 상태 표시
```

---

## 7. 구현 순서

1. `0007_meeting_notes.sql` — DB 마이그레이션
2. `src/types/index.ts` — Meeting / MeetingAttendee / ActionItem / AgendaItem 타입
3. `layout.tsx` — 사이드바에 /meetings 추가
4. `meetings/page.tsx` — 목록 + 미니캘린더 기본 구조
5. `MeetingMiniCalendar.tsx` — 달력 컴포넌트
6. `MeetingListItem.tsx` — 목록 카드
7. `meetings/[id]/page.tsx` — 3열 레이아웃 + 데이터 로딩
8. `MeetingTimer.tsx` — 타이머
9. `MeetingAgenda.tsx` — 안건 체크리스트
10. `MeetingNotes.tsx` — 마크다운 편집/미리보기
11. `MeetingAttendees.tsx` — 참석자 (CRM 연동)
12. `ActionItemPanel.tsx` — 액션 아이템 + 이월 + 내보내기

---

## 8. 패키지 확인

모두 설치됨 (추가 설치 불필요):
- `react-markdown ^10.1.0` ✅
- `remark-gfm ^4.0.1` ✅
- `rehype-sanitize ^6.0.0` ✅
- `date-fns ^4.4.0` ✅ (미니캘린더 날짜 계산)
- `lucide-react ^1.17.0` ✅ (`ClipboardList`, `Play`, `Square`, `CheckSquare`, `ExternalLink`, `Check`)
