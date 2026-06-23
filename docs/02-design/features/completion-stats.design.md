# Design: completion-stats — 완료 통계 시각화

> Plan 참조: `docs/01-plan/features/completion-stats.plan.md`

---

## 1. 구현 범위 확정

| # | 항목 | 구현 여부 |
|---|------|-----------|
| 1 | recharts 설치 | ✅ |
| 2 | 주간 요일별 완료 바 차트 | ✅ |
| 3 | 월간 주차별 완료 바 차트 | ✅ |
| 4 | 주간/월간 탭 전환 | ✅ |
| 5 | 월간 완료 태스크 별도 쿼리 | ✅ |
| 6 | 차트 위치: 요약 카드 아래, 요일별 그리드 위 | ✅ |

> DB 변경 없음 — 차트 컴포넌트 신규 파일 + report/page.tsx 수정

---

## 2. 아키텍처

```
src/app/(main)/report/page.tsx
  ├── chartView 상태 ('weekly' | 'monthly')
  ├── monthCompletedTasks 쿼리 (chartView === 'monthly'일 때만 활성)
  ├── weeklyChartData useMemo (기존 tasksByDay 재활용)
  ├── monthlyChartData useMemo
  └── <CompletionBarChart> 삽입 (요약 카드 아래)

src/components/report/CompletionBarChart.tsx (신규)
  └── recharts BarChart — 주간/월간 공용 컴포넌트
```

---

## 3. 상세 설계

### 3-1. 의존성

```bash
npm install recharts
```

- recharts: React용 SVG 차트, Next.js 'use client' 환경 지원
- 추가 패키지 없음

---

### 3-2. 상태 추가 (`report/page.tsx`)

```typescript
const [chartView, setChartView] = useState<'weekly' | 'monthly'>('weekly')
```

---

### 3-3. 월간 데이터 쿼리

```typescript
function getMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  return { start, end }
}

const { start: monthStart, end: monthEnd } = getMonthRange()

const { data: monthCompletedTasks = [] } = useQuery<Task[]>({
  queryKey: ['monthly-completed-tasks'],
  enabled: chartView === 'monthly',
  queryFn: async () => {
    const doneColRes = await supabase.from('columns').select('id').eq('name', '완료')
    const doneIds = (doneColRes.data ?? []).map(c => c.id)
    if (doneIds.length === 0) return []
    const { data, error } = await supabase
      .from('tasks')
      .select('id, updated_at')
      .is('deleted_at', null)
      .eq('archived', false)
      .in('status', doneIds)
      .gte('updated_at', monthStart.toISOString())
      .lte('updated_at', monthEnd.toISOString())
    if (error) throw error
    return data ?? []
  },
})
```

---

### 3-4. 차트 데이터 가공

#### 주간 (기존 `tasksByDay` 재활용)

```typescript
const weeklyChartData = useMemo(() =>
  days.map((d, i) => ({
    label: DAY_LABELS[i],
    completed: tasksByDay[toDateKey(d.toISOString())]?.completed.length ?? 0,
  })),
  [days, tasksByDay]
)
```

#### 월간 (주차별 집계)

```typescript
const monthlyChartData = useMemo(() => {
  const daysInMonth = new Date(
    monthStart.getFullYear(), monthStart.getMonth() + 1, 0
  ).getDate()
  const weekCount = Math.ceil(daysInMonth / 7)
  const weeks = Array.from({ length: weekCount }, (_, i) => ({
    label: `${i + 1}주`,
    completed: 0,
  }))
  for (const t of monthCompletedTasks) {
    const day = new Date(t.updated_at).getDate()
    const weekIdx = Math.min(Math.ceil(day / 7) - 1, weekCount - 1)
    weeks[weekIdx].completed++
  }
  return weeks
}, [monthCompletedTasks, monthStart])
```

---

### 3-5. `CompletionBarChart` 컴포넌트

**파일:** `src/components/report/CompletionBarChart.tsx`

```tsx
'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'

interface ChartData {
  label: string
  completed: number
}

interface Props {
  data: ChartData[]
  highlightIndex?: number  // 오늘(주간) 또는 현재 주차(월간) 강조
}

export default function CompletionBarChart({ data, highlightIndex }: Props) {
  const max = Math.max(...data.map(d => d.completed), 1)

  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data} barCategoryGap="30%">
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis hide domain={[0, max + 1]} />
        <Tooltip
          cursor={{ fill: 'rgba(0,0,0,0.04)' }}
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null
            return (
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs shadow-sm">
                <span className="text-gray-500 dark:text-gray-400">{label}: </span>
                <span className="font-semibold text-green-600 dark:text-green-400">{payload[0].value}개</span>
              </div>
            )
          }}
        />
        <Bar dataKey="completed" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell
              key={i}
              fill={i === highlightIndex ? '#22c55e' : '#bbf7d0'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
```

---

### 3-6. report/page.tsx 삽입 위치

요약 카드(`grid grid-cols-3`) 바로 아래, 요일별 그리드(`grid grid-cols-7`) 바로 위:

```tsx
{/* 완료 통계 차트 */}
<div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-8">
  <div className="flex items-center justify-between mb-3">
    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">완료 추이</p>
    <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
      <button
        onClick={() => setChartView('weekly')}
        className={cn('px-2.5 py-1 text-xs rounded-md transition-colors font-medium',
          chartView === 'weekly'
            ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
        )}
      >주간</button>
      <button
        onClick={() => setChartView('monthly')}
        className={cn('px-2.5 py-1 text-xs rounded-md transition-colors font-medium',
          chartView === 'monthly'
            ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
        )}
      >월간</button>
    </div>
  </div>
  <CompletionBarChart
    data={chartView === 'weekly' ? weeklyChartData : monthlyChartData}
    highlightIndex={chartView === 'weekly' ? todayDayIndex : currentWeekIndex}
  />
</div>
```

**`todayDayIndex`** (주간 오늘 인덱스):
```typescript
const todayDayIndex = useMemo(() =>
  days.findIndex(d => toDateKey(d.toISOString()) === todayKey),
  [days, todayKey]
)
```

**`currentWeekIndex`** (월간 이번 주차):
```typescript
const currentWeekIndex = Math.min(Math.ceil(new Date().getDate() / 7) - 1, 4)
```

---

## 4. import 추가 (`report/page.tsx`)

```typescript
import CompletionBarChart from '@/components/report/CompletionBarChart'
```

---

## 5. 파일별 변경 요약

| 파일 | 변경 유형 | 내용 |
|------|-----------|------|
| `src/components/report/CompletionBarChart.tsx` | 신규 | recharts BarChart 래퍼, Cell로 오늘/이번주 강조 |
| `src/app/(main)/report/page.tsx` | 수정 | `chartView` 상태, 월간 쿼리, 차트 데이터 useMemo 2개, 차트 UI 삽입 |

---

## 6. 구현 순서

```
1. npm install recharts
2. src/components/report/ 디렉토리 생성
3. CompletionBarChart.tsx 작성
4. report/page.tsx
   a. chartView 상태 추가
   b. getMonthRange() 함수 추가
   c. monthCompletedTasks 쿼리 추가
   d. weeklyChartData useMemo 추가
   e. monthlyChartData useMemo 추가
   f. todayDayIndex, currentWeekIndex 추가
   g. CompletionBarChart import
   h. 차트 UI 삽입 (요약 카드 아래)
```

---

## 7. 테스트 시나리오

| 시나리오 | 기대 결과 |
|----------|-----------|
| 주간 탭 (기본) | 월~일 7개 바, 오늘 초록색 강조 |
| 완료 0개인 날 | 바 높이 0 (빈 바) |
| 월간 탭 클릭 | 주차별 바 (1주~N주), 이번 주차 강조 |
| 이전 주로 이동 | 주간 차트 해당 주 데이터 반영 |
| dark 모드 | tooltip, 바 색상 dark 적용 |
| recharts SSR | 'use client' 컴포넌트로 분리 → 에러 없음 |
