# Plan: recurring-tasks — 반복 태스크 / 반복 일정

> 상태: **Plan 확정** — 2026-06-25
> 선행 기능: 없음 (독립 기능)

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 매주 회의, 매월 마감 같은 반복 일정을 매번 수동으로 만들어야 해서 누락 및 번거로움이 발생한다 |
| **Solution** | 태스크에 반복 규칙(매일/매주/매월/매년)을 설정하면, 저장 시 향후 N개 인스턴스를 DB에 자동 생성 |
| **Function UX Effect** | 생성 모달에 "반복" 토글 추가 — 규칙 선택 → 저장하면 캘린더에 반복 점선 뱃지로 즉시 표시 |
| **Core Value** | 반복 업무를 한 번만 설정하면 캘린더·Today·칸반에 자동 분배, 관리 피로 제거 |

---

## 1. 반복 규칙 스펙

| 타입 | 예시 | 설명 |
|------|------|------|
| `daily` | 매일 | interval=1 |
| `weekly` | 매주 월·목 | interval=1, days_of_week=[1,4] |
| `monthly` | 매월 15일 | interval=1, day_of_month=15 |
| `yearly` | 매년 1월 1일 | interval=1 |

**인스턴스 생성 범위**: 저장 시점부터 **3개월치** 또는 **최대 12개** 중 작은 값.

---

## 2. DB 스키마 변경

```sql
-- tasks 테이블 컬럼 추가
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS recurrence_type    TEXT    CHECK (recurrence_type IN ('daily','weekly','monthly','yearly')),
  ADD COLUMN IF NOT EXISTS recurrence_interval INT    DEFAULT 1,
  ADD COLUMN IF NOT EXISTS recurrence_days    INT[]  DEFAULT NULL,   -- weekly: 요일 배열 [0=일..6=토]
  ADD COLUMN IF NOT EXISTS recurrence_end     DATE   DEFAULT NULL,   -- 반복 종료일 (null = 무기한)
  ADD COLUMN IF NOT EXISTS parent_task_id     UUID   REFERENCES tasks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_recurring_root  BOOL   DEFAULT FALSE;
```

- `recurrence_type NULL` = 반복 없음 (기존 태스크 영향 없음)
- `parent_task_id NULL` = 원본(root) 태스크
- `parent_task_id NOT NULL` = 자동 생성된 인스턴스

---

## 3. 인스턴스 생성 로직

태스크 저장(create/update) 시 `recurrence_type`이 있으면:

```
1. 기존 미래 인스턴스 삭제 (parent_task_id = 현재 task.id AND due_date > today)
2. 원본 태스크의 due_date를 시작점으로, 규칙에 따라 다음 due_date 계산
3. 3개월 이내 or 12개 한도로 인스턴스 생성 (INSERT)
   - title, project_id, status, priority, tags 복사
   - parent_task_id = 원본 task.id
   - is_recurring_root = FALSE
```

클라이언트(Next.js API Route 또는 Supabase Edge Function)에서 처리.
첫 구현은 **Next.js API Route** (`/api/recurring/generate`) 사용.

---

## 4. 구현 범위

| 파일 | 변경 내용 |
|------|-----------|
| `supabase/migrations/XXXX_recurring_tasks.sql` | 컬럼 추가 |
| `src/types/index.ts` | Task 타입에 recurrence 필드 추가 |
| `src/app/api/recurring/generate/route.ts` | 인스턴스 생성 API (신규) |
| `src/components/kanban/CreateTaskModal.tsx` | "반복" 토글 + 규칙 선택 UI |
| `src/components/kanban/TaskModal.tsx` | 반복 인스턴스 배지 표시 + "이 항목만/이후 모두 수정" 선택 |
| `src/app/(main)/calendar/page.tsx` | 반복 태스크 점선 테두리 뱃지 표시 |

---

## 5. UI 설계 — 생성 모달

```
┌─ 반복 ────────────────────────────────┐
│  [반복 없음 v]  ←  드롭다운           │
│  매일 / 매주 / 매월 / 매년            │
│                                        │
│  (매주 선택 시)                        │
│  [월] [화] [수] [목] [금] [토] [일]   │
│                                        │
│  종료: [날짜 없음 v] / [날짜 선택]    │
└────────────────────────────────────────┘
```

---

## 6. 반복 인스턴스 수정 시나리오

태스크 모달에서 반복 인스턴스를 수정하면:

```
"이 항목만 수정" → 해당 인스턴스만 변경 (parent 연결 유지)
"이후 모두 수정" → parent_task 업데이트 → 미래 인스턴스 재생성
"모든 항목 수정" → 동일 (이후 모두 수정과 동일 처리)
```

---

## 7. 캘린더 표시

- 반복 인스턴스 태스크 카드: 왼쪽에 `↻` 아이콘 표시
- 색상·크기는 일반 태스크와 동일

---

## 8. 주의사항

- 반복 인스턴스 삭제는 "이 항목만" 삭제 (parent 및 다른 인스턴스 유지)
- 완료(체크) 처리는 해당 인스턴스만 완료 처리
- 인스턴스가 오래되어 소진되면(3개월 경과) 앱 접속 시 자동 추가 생성 고려 → **v2에서 구현**
