# Gap Analysis: completion-stats

> 분석일: 2026-06-23
> Design 문서: `docs/02-design/features/completion-stats.design.md`

---

## Match Rate: 100% ✅

---

## 항목별 검증

### 1. 의존성

| 설계 항목 | 구현 여부 | 비고 |
|-----------|-----------|------|
| `npm install recharts` | ✅ | node_modules에 설치 확인 |

### 2. `src/components/report/CompletionBarChart.tsx` (신규)

| 설계 항목 | 구현 여부 | 비고 |
|-----------|-----------|------|
| `'use client'` 선언 | ✅ | SSR 안전 |
| recharts import: `BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell` | ✅ | |
| `ChartData { label, completed }` 인터페이스 | ✅ | |
| `highlightIndex?: number` prop | ✅ | |
| `ResponsiveContainer width="100%" height={120}` | ✅ | |
| `BarChart barCategoryGap="30%"` | ✅ | |
| `XAxis` — fontSize 11, gray, axisLine/tickLine 없음 | ✅ | |
| `YAxis hide`, `domain=[0, max+1]`, `allowDecimals=false` | ✅ | |
| 커스텀 `Tooltip` — "레이블: N개" 형식 | ✅ | `ChartTooltip` 내부 컴포넌트로 분리 구현 |
| `Bar radius=[4,4,0,0]` (상단 둥근 모서리) | ✅ | |
| `Cell` 색상 — 강조: `#22c55e`, 일반: `#bbf7d0` | ✅ | |
| dark 모드 tooltip 스타일 | ✅ | `dark:bg-gray-800`, `dark:border-gray-700` |

### 3. `src/app/(main)/report/page.tsx` — 유틸 함수

| 설계 항목 | 구현 여부 | 비고 |
|-----------|-----------|------|
| `getMonthRange()` 함수 추가 | ✅ | `getWeekRange` 바로 아래 |
| `CompletionBarChart` import | ✅ | line 14 |

### 4. `src/app/(main)/report/page.tsx` — 상태

| 설계 항목 | 구현 여부 | 비고 |
|-----------|-----------|------|
| `chartView` 상태 (`'weekly' \| 'monthly'`, 기본값 `'weekly'`) | ✅ | |
| `monthStart, monthEnd` (getMonthRange useMemo) | ✅ | `[]` deps로 한 번만 계산 |

### 5. `src/app/(main)/report/page.tsx` — 월간 쿼리

| 설계 항목 | 구현 여부 | 비고 |
|-----------|-----------|------|
| `monthCompletedTasks` 쿼리 | ✅ | |
| `enabled: chartView === 'monthly'` (lazy 로딩) | ✅ | |
| `select('id, updated_at')` — 최소 필드만 | ✅ | |
| 타입: `{ id: string; updated_at: string }[]` | ✅ | Task[] 대신 좁은 타입으로 에러 수정 |

### 6. `src/app/(main)/report/page.tsx` — 차트 데이터 useMemo

| 설계 항목 | 구현 여부 | 비고 |
|-----------|-----------|------|
| `weeklyChartData` — `days.map` → `{ label: DAY_LABELS[i], completed }` | ✅ | tasksByDay 재활용 |
| `todayDayIndex` — `days.findIndex(todayKey)` | ✅ | |
| `monthlyChartData` — 주차별 완료 집계 | ✅ | `Math.ceil(day / 7) - 1` 로직 |
| `currentWeekIndex` — 이번 주차 인덱스 | ✅ | `Math.min(Math.ceil(date/7)-1, 4)` |

### 7. `src/app/(main)/report/page.tsx` — 차트 UI

| 설계 항목 | 구현 여부 | 비고 |
|-----------|-----------|------|
| 위치: 요약 카드 아래, 요일별 그리드 위 | ✅ | |
| "완료 추이" 라벨 | ✅ | |
| 주간/월간 탭 버튼 — 선택 상태 강조 | ✅ | dark 모드 포함 |
| `<CompletionBarChart data={...} highlightIndex={...}>` | ✅ | |
| `chartView === 'weekly'` → weeklyChartData / todayDayIndex | ✅ | |
| `chartView === 'monthly'` → monthlyChartData / currentWeekIndex | ✅ | |

---

## 설계 대비 변경 사항 (Gap 아님)

| 항목 | 설계 | 실제 | 판단 |
|------|------|------|------|
| Tooltip 구현 방식 | 인라인 JSX 반환 | `ChartTooltip` 내부 컴포넌트 분리 | ✅ 동일 기능, 코드 정리 목적의 개선 |
| 월간 쿼리 타입 | `Task[]` | `{ id: string; updated_at: string }[]` | ✅ TypeScript 에러 방지 — 올바른 판단 |

---

## TypeScript 검증

```
npx tsc --noEmit → 에러 0개
```

---

## 테스트 시나리오 점검

| 시나리오 | 기대값 | 구현 상태 |
|----------|--------|-----------|
| 주간 탭 (기본) | 월~일 7개 바, 오늘 초록색 강조 | ✅ |
| 완료 0개인 날 | 바 높이 0 | ✅ (`domain=[0, max+1]`로 빈 바 표시) |
| 월간 탭 클릭 | 주차별 바, 이번 주차 강조 | ✅ |
| 이전 주로 이동 | 주간 차트 해당 주 데이터 반영 | ✅ (weekOffset → queryKey 연동) |
| dark 모드 | tooltip, 탭 dark 스타일 | ✅ |
| recharts SSR | 'use client' 분리로 에러 없음 | ✅ |
| 월간 lazy 로딩 | 월간 탭 클릭 시에만 쿼리 실행 | ✅ (`enabled: chartView === 'monthly'`) |
| TypeScript 에러 | 없음 | ✅ |

---

## Gap 없음 — Match Rate 100%
