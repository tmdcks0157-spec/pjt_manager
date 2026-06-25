# Gap Analysis: meeting-notes

> 분석일: 2026-06-26
> Match Rate: **96%** ✅ (Act 단계 불필요)

---

## 결과 요약

| 항목 | 수 |
|------|----|
| 전체 스펙 체크포인트 | 12 |
| 완전 일치 ✅ | 11 |
| 설계 보강 (추가 구현) ➕ | 6 |
| 편차 (수정 필요) 🔧 | 1 |

---

## ✅ 구현 완료

| 스펙 항목 | 구현 위치 |
|-----------|----------|
| DB 스키마 3테이블 + RLS WITH CHECK + 트리거 | `0007_meeting_notes.sql` |
| Meeting 타입 (project join 포함) | `types/index.ts` |
| 사이드바 /meetings ClipboardList | `layout.tsx:20` |
| 목록 페이지: 미니캘린더 + 날짜 그룹핑 + 월 통계 | `meetings/page.tsx` |
| MeetingListItem: color dot / 미연결 표시 | `MeetingListItem.tsx` |
| 상세 페이지 3열 레이아웃 (w-56 / flex-1 / w-72) | `meetings/[id]/page.tsx` |
| MeetingTimer: 3상태 전환 + started_at 재계산 | `MeetingTimer.tsx` |
| MeetingAgenda: JSONB 체크토글 + 추가/삭제 | `MeetingAgenda.tsx` |
| MeetingNotes: 편집↔미리보기 탭 + 1초 debounce | `MeetingNotes.tsx` |
| MeetingAttendees: CRM 자동완성 + 자유 입력 | `MeetingAttendees.tsx` |
| ActionItemPanel: 이월 배너 + 프로젝트 분기 export | `ActionItemPanel.tsx` |
| 새 회의 생성 후 상세 페이지 이동 | `meetings/page.tsx:65` |

---

## ➕ 설계 대비 보강 (의도에 부합)

| 항목 | 설명 |
|------|------|
| MeetingListItem 미완료 카운트 | `· 미완료 N건` 표시 — 목록에서 액션 현황 파악 |
| MeetingAgenda 인라인 추가/삭제 | 추가 폼 + X 버튼 삭제 — 설계보다 상세 구현 |
| ActionItemPanel 완료/미완료 섹션 분리 | done 항목을 하단 별도 섹션으로 분리 |
| ActionItemPanel 삭제 버튼 | 설계에 없던 X 버튼 추가 |
| RLS WITH CHECK 추가 | INSERT 보안 강화 |
| Timer elapsed 초기값 completed 상태 반영 | duration_minutes × 60으로 재계산 |

---

## 🔧 편차 (수정 필요)

| 항목 | 설계 | 구현 | 영향 |
|------|------|------|------|
| pending-actions 범위 | 같은 project_id 기준 | 전체 open 액션 (project_id 필터 없음) | 프로젝트 미연결 회의에서도 배너 표시, 타 프로젝트 액션 혼입 |

**수정 위치:** `src/app/(main)/meetings/[id]/page.tsx:53-66`

```typescript
// 현재 (전체 open 조회)
.eq('status', 'open')
.neq('meeting_id', id)

// 수정 후 (같은 project_id 범위만, 미연결이면 조회 안 함)
enabled: !!user && !!meeting?.project_id,
.eq('status', 'open')
.neq('meeting_id', id)
// + action_items → meeting_id → meetings.project_id 필터
```

---

## 결론

편차 1건 수정 후 완전 구현 완료. `/pdca report meeting-notes` 진행 가능.
