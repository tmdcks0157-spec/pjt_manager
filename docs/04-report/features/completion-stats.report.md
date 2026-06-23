# Report: completion-stats — 완료 통계 시각화

> 완료일: 2026-06-23
> Commit: `654eea9`

---

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | completion-stats |
| 완료일 | 2026-06-23 |
| Match Rate | **100%** |
| 변경 파일 | 2개 (`CompletionBarChart.tsx` 신규, `report/page.tsx` 수정) |
| 의존성 추가 | `recharts` |

### Value Delivered

| 관점 | 내용 |
|------|------|
| **Problem** | report 페이지에 주간 완료 숫자는 있었지만 차트가 없어 추세·패턴을 한눈에 파악하기 어려웠다 |
| **Solution** | recharts BarChart를 별도 컴포넌트(`CompletionBarChart`)로 분리 후 주간/월간 탭 전환 방식으로 통합 — 기존 쿼리 데이터 재활용 |
| **Function UX Effect** | 어느 요일에 가장 많이 완료했는지 막대 높이로 즉시 파악, 오늘(주간)/이번 주차(월간)는 초록색으로 강조, 월간 탭 클릭 시에만 추가 쿼리 실행(lazy) |
| **Core Value** | 완료 기록이 동기부여 데이터로 전환 — "이번 주 화요일에 7개 완료" 같은 패턴 인사이트 즉시 확인 가능 |

---

## 1. 구현 내역

### 1.1 파일별 변경

| 파일 | 변경 유형 | 핵심 내용 |
|------|-----------|-----------|
| `src/components/report/CompletionBarChart.tsx` | 신규 | recharts BarChart 래퍼, Cell로 오늘/이번주 강조, 커스텀 Tooltip |
| `src/app/(main)/report/page.tsx` | 수정 | `chartView` 상태, `getMonthRange()`, 월간 lazy 쿼리, `weeklyChartData`/`monthlyChartData` useMemo, 차트 UI 삽입 |

### 1.2 기능별 구현 세부

#### ① `CompletionBarChart` 컴포넌트

```tsx
// 오늘(주간) / 이번 주차(월간) 강조
<Cell fill={i === highlightIndex ? '#22c55e' : '#bbf7d0'} />

// 커스텀 Tooltip — "화: 5개"
<ChartTooltip />

// YAxis hidden, domain 동적 — 빈 바도 표시
<YAxis hide domain={[0, max + 1]} allowDecimals={false} />
```

#### ② 주간 차트 데이터

```typescript
// 기존 tasksByDay useMemo 재활용 — 추가 쿼리 없음
const weeklyChartData = useMemo(() =>
  days.map((d, i) => ({
    label: DAY_LABELS[i],
    completed: tasksByDay[toDateKey(d.toISOString())]?.completed.length ?? 0,
  })),
  [days, tasksByDay]
)
```

#### ③ 월간 lazy 쿼리

```typescript
const { data: monthCompletedTasks = [] } = useQuery<{ id: string; updated_at: string }[]>({
  queryKey: ['monthly-completed-tasks', monthStart.toISOString()],
  enabled: chartView === 'monthly',  // 탭 클릭 시에만 실행
  queryFn: async () => { /* select id, updated_at */ }
})
```

#### ④ 주간/월간 탭 UI

```tsx
<div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
  <button onClick={() => setChartView('weekly')}>주간</button>
  <button onClick={() => setChartView('monthly')}>월간</button>
</div>
```

---

## 2. 설계 대비 조정 사항

| 항목 | 설계 | 실제 | 이유 |
|------|------|------|------|
| 컴포넌트 분리 | `WeeklyBarChart.tsx` + `MonthlyBarChart.tsx` 2개 | `CompletionBarChart.tsx` 1개 | 두 차트가 동일 구조(label/completed) → 단일 공용 컴포넌트가 더 간결 |
| Tooltip 구현 | 인라인 JSX | `ChartTooltip` 내부 컴포넌트 | TypeScript `recharts` 타입 제약 → 컴포넌트 분리로 타입 안전성 확보 |
| 월간 쿼리 타입 | `Task[]` | `{ id: string; updated_at: string }[]` | 불필요한 전체 필드 로드 방지 + TypeScript 에러 방지 |

---

## 3. Gap 분석 결과

| 구분 | 항목 수 | 결과 |
|------|---------|------|
| 설계 항목 총계 | 32개 | |
| 구현 완료 | 32개 | ✅ 100% |
| 미구현 | 0개 | |
| 설계 대비 조정 | 3개 | 모두 개선 방향 (Gap 아님) |

---

## 4. 기술 품질

| 항목 | 결과 |
|------|------|
| TypeScript 에러 | 0개 |
| DB 마이그레이션 | 없음 |
| 새 의존성 | `recharts` 1개 |
| 기존 기능 영향 | 없음 (독립 UI 블록 추가) |
| SSR 안전성 | `'use client'` 분리로 보장 |
| 성능 최적화 | 월간 쿼리 lazy 로딩, 주간은 기존 데이터 재활용 |

---

## 5. 학습 및 노트

- **recharts SSR 주의**: recharts는 브라우저 DOM에 의존하므로 반드시 `'use client'` 컴포넌트로 분리. `page.tsx`가 서버 컴포넌트면 import 시 에러.
- **단일 공용 컴포넌트 설계**: 주간/월간 차트가 같은 `{ label, completed }` 구조를 공유하면 하나의 컴포넌트로 통합 가능 — `highlightIndex` 하나로 오늘/이번주 강조 모두 처리.
- **YAxis hidden + domain 설정**: `hide`만 하면 0개 데이터 시 바가 사라질 수 있음 → `domain={[0, max+1]}`로 빈 바도 정상 렌더링 보장.
- **lazy 쿼리 패턴**: `enabled: chartView === 'monthly'`로 탭 클릭 시에만 쿼리 실행 — 기본 화면(주간) 로딩 시간 절약.
- **타입 최소화**: 월간 쿼리에 `Task[]` 대신 `{ id: string; updated_at: string }[]` 사용 — 실제 필요한 필드만 타입 정의, 번들 안전성 향상.

---

## 6. 다음 단계

| 우선순위 | 기능 | 문서 |
|----------|------|------|
| 백로그 | 이슈기록 강화 (마크다운 노트) | `docs/01-plan/features/markdown-notes.plan.md` |
| 백로그 | 태스크 담당자 복수 지정 | `docs/01-plan/features/multi-assignee.plan.md` |
