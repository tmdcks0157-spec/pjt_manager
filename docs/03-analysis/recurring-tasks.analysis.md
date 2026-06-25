# Gap Analysis: recurring-tasks

> 분석일: 2026-06-25  
> Match Rate: **93%** ✅ (편차 수정 후)

---

## 결과 요약

| 항목 | 수 |
|------|----|
| 전체 스펙 항목 | 16 |
| 구현 완료 ✅ | 14 |
| 인텐셔널 스코프 축소 ℹ️ | 3 |
| 편차 (수정 완료) | 1 |

---

## ✅ 구현 완료

| 스펙 항목 | 구현 위치 |
|-----------|----------|
| recurrence_type TEXT CHECK ('daily','weekly','monthly','yearly') | `0006_recurring_tasks.sql:3` |
| recurrence_interval INT DEFAULT 1 | `0006:4` |
| recurrence_end DATE | `0006:5` |
| parent_task_id UUID REFERENCES tasks ON DELETE CASCADE | `0006:6` |
| is_recurring_root BOOL DEFAULT FALSE | `0006:7` |
| idx_tasks_parent_task_id 인덱스 | `0006:9` |
| Task 타입 5개 필드 추가 | `types/index.ts:45-49` |
| 최대 12개, 최대 3개월 앞 | `recurrenceUtils.ts:13-14` |
| 미래 인스턴스만 삭제 (과거 이력 보존) | `recurrenceUtils.ts:60` (수정 완료) |
| 인스턴스 필드 복사 (contact, tags, etc.) | `recurrenceUtils.ts:64-86` |
| 반복 규칙 UI (없음/매일/매주/매월/매년) | `TaskModal.tsx:281-291` |
| 간격 입력 1–10 | `TaskModal.tsx:296-300` |
| 종료일 입력 | `TaskModal.tsx:303-307` |
| 캘린더 셀 ↻ 아이콘 | `calendar/page.tsx:658-660` |
| QuickTaskModal 반복 select | `calendar/page.tsx:271-278` |
| createTaskMutation → generateInstances | `calendar/page.tsx:466-475` |

---

## ℹ️ 인텐셔널 스코프 축소 (계획에 반영됨)

| 항목 | 이유 |
|------|------|
| 요일별 선택 (recurrence_days INT[]) | weekly = 시작일 기준 N주 단위로 단순화. 추후 v2 |
| 수정 다이얼로그 (이 항목만/이후 모두) | 인스턴스 편집 = 해당 항목만 수정 + 안내 문구로 대체 |
| 별도 API Route | 클라이언트 사이드 recurrenceUtils.ts로 대체 |

---

## 🔧 편차 수정 내역

| 편차 | 수정 전 | 수정 후 |
|------|---------|---------|
| 인스턴스 삭제 범위 | `.eq('parent_task_id', rootId)` — 전체 삭제 | `.gt('due_date', nowIso)` — 미래만 삭제 |

수정 파일:
- `src/lib/recurrenceUtils.ts:60`
- `src/components/kanban/TaskModal.tsx:157`

---

## 🟡 Minor Observations (비 Critical)

- QuickTaskModal은 recurrence_interval을 1 고정 (TaskModal은 1–10 입력 가능). 미사양 항목이므로 Gap 아님
- 인스턴스 생성 시 `notes: ''` 하드코딩 (plan 미사양 — 허용)

---

## 결론

편차 수정 후 모든 in-scope 항목 구현 완료. `/pdca report recurring-tasks` 진행 가능.
