# My Project Manager

개인 업무 관리를 위한 올인원 웹 앱. 프로젝트 칸반, CRM, 캘린더, 주간 리포트를 하나의 앱에서 관리.

## 기술 스택

| 분류 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 (App Router) |
| 언어 | TypeScript |
| 스타일 | Tailwind CSS v4 |
| 상태 관리 | TanStack Query v5 |
| 백엔드 | Supabase (Auth + PostgreSQL + RLS) |
| 배포 | Vercel |
| 아이콘 | Lucide React |

## 페이지 구성

| 경로 | 이름 | 주요 기능 |
|------|------|-----------|
| `/today` | 오늘 | 오늘 마감/일정/기한초과/긴급 태스크 + 이번 주 마감 예정 미리보기 + 오늘 등록한 것 |
| `/dashboard` | 프로젝트 | 프로젝트 카드 목록, 진행률/통계, 정렬/필터 |
| `/projects/[id]` | 칸반 보드 | 드래그앤드롭 칸반, 태스크 상세 모달, 체크리스트, 일괄 선택/이동 |
| `/projects/[id]/issues` | 이슈 & 기록 | 이슈 트래커 + 히스토리 피드 |
| `/overview` | 전체 현황 | 모든 프로젝트 태스크/이슈 통합 뷰, 클릭 시 오른쪽 패널에서 편집 |
| `/calendar` | 캘린더 | 월간 캘린더, 마감/일정 표시, 좌측 사이드바 태스크 목록 |
| `/report` | 주간 리포트 | 이번 주 완료/생성/지연 요약, 요일별 태스크 그리드 |
| `/crm` | 연락처 | 연락처/회사 목록, 이메일·전화 원클릭 링크 |
| `/crm/contacts/[id]` | 연락처 상세 | 활동 타임라인, 연결된 이슈/태스크 |
| `/settings` | 설정 | 테마(light/dark/system), 시작 페이지, 비밀번호 변경 |

## 주요 기능

### 프로젝트 & 칸반
- 프로젝트별 칸반 보드 (컬럼 커스텀, 순서 변경, WIP limit)
- 태스크: 제목/설명/메모/마감일/우선순위/체크리스트/연락처 연결
- 태스크 이동/복사 (다른 프로젝트로), 일괄 선택/이동
- 마감일 임박 강조 (오늘=주황/내일=노랑/기한초과=빨강)
- 프로젝트 보관/복구 (soft delete)
- 전역 태스크 검색

### 오늘 (Today)
- 오늘 마감·일정·기한초과·긴급 태스크 자동 분류
- **이번 주 마감 예정** 미리보기 (내일~일요일)
- 연락처 연결 태스크 → "연락할 것" 섹션 자동 표시
- 오늘 완료 처리한 태스크 목록 (완료 취소 가능)
- 이슈/기록 인라인 빠른 등록

### CRM
- 연락처 (이름/이메일/전화/태그/회사 연결), 전화·이메일 원클릭
- 회사 관리 및 연락처 연결
- 활동 로그 (전화/미팅/이메일/기타 유형)
- 칸반 태스크에 연락처 연결 → Today "연락할 것" 자동 노출

### 전체 현황
- 전체 프로젝트 태스크를 기한초과/오늘마감/긴급/높음 필터로 조회
- 태스크 클릭 → 우측 패널에서 즉시 편집 (제목/우선순위/마감일/설명/메모)
- 이슈 & 기록 탭 — 상태 변경/편집 가능

### 다크모드
- light / dark / system 3단계 테마
- Tailwind CSS v4 `@variant dark` 패턴
- 설정 페이지에서 변경, localStorage 영속화

## DB 스키마 (Supabase)

```
projects       — id, name, color, description, archived
columns        — id, project_id, name, color, order, wip_limit
tasks          — id, project_id, status(column_id), title, description, notes,
                 priority, due_date, task_type, checklist_items, contact_id,
                 created_at, updated_at
posts          — id, project_id, type(issue/note), title, body, status, priority,
                 contact_id, recorded_at, created_at
companies      — id, name, industry, website, phone, address, notes
contacts       — id, name, email, phones[], company_id, tags[], notes
activities     — id, contact_id, type, title, body, occurred_at
```

모든 테이블에 RLS(Row Level Security) 적용 — `auth.uid()` 기준.

## 로컬 실행

```bash
npm install
npm run dev
```

`.env.local` 에 Supabase 환경 변수 필요:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## 배포

Vercel 자동 배포 (main 브랜치 push → Vercel CI/CD)

## 개발 도구

- `scripts/screenshot.mjs` — Playwright 스크린샷 자동 캡처 스크립트
  ```bash
  node scripts/screenshot.mjs
  ```
  (로컬 개발 서버 실행 중일 때 사용, `scripts/screenshots/` 에 저장)
