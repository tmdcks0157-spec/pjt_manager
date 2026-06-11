# 작업일지

---

## 2026-06-12

### 추가/변경 기능

**Today 대시보드 전면 개편** (`/today`)

레이아웃
- 단일 컬럼(max-w-2xl) → 2컬럼 그리드(lg:grid-cols-2, max-w-7xl)
- 왼쪽: 처리할 것 (오늘 일정/마감/기한초과/긴급/처리완료)
- 오른쪽: 오늘 등록한 것 (태스크 프로젝트별/이슈·기록)

빠른 추가
- 1줄 바 → `[태스크/일정 추가]` (모달) + `[이슈/기록 추가]` (인라인 토글) 2버튼 구조
- `CreateTaskModal` 공유 컴포넌트 신규 생성 (`src/components/CreateTaskModal.tsx`)
  - 프로젝트 선택 / 태스크·일정 타입 토글 / 우선순위 / 마감일 / 설명 / 태그 / 메모
  - 체크리스트: 항목 입력 후 Enter/+ 추가, hover × 삭제
  - 태스크 INSERT 후 반환된 id로 checklist_items 일괄 INSERT (2-step)
- 이슈/기록 인라인 폼: 이슈 페이지와 동일 구성 (타입/제목/본문/우선순위)

오늘 등록한 태스크 섹션 (오른쪽)
- created_at 기준 오늘 등록된 태스크를 프로젝트별 그룹화
- 완료 처리: Square 클릭 → doneMutation → 완료 컬럼 이동
- 완료 취소: CheckCircle2 클릭 → undoneMutation → 첫 번째 활성 컬럼 복원

오늘 이슈/기록 섹션 (오른쪽)
- 이슈 닫기: Circle 클릭 → closed 전환, 취소선 + 닫힘 배지
- 이슈 다시 열기: CheckCircle2 클릭 또는 hover 시 RotateCcw 버튼
- 기록(note): 상태 변경 없이 아이콘만 표시

처리 완료 섹션 (왼쪽 하단)
- updated_at >= todayStart + 완료 컬럼 조건으로 오늘 완료 태스크 표시
- 접힘/펼침 토글, 취소선 + 초록 체크
- CheckCircle2 클릭 → 완료 취소 (firstColByProject 복원)

### 버그 수정

- `doneMutation`에 `updated_at: new Date().toISOString()` 명시 추가
  → Supabase 자동 갱신 트리거 부재 시 처리완료 필터 누락 방지
- Supabase SQL로 `tasks` 테이블 `updated_at` 자동 갱신 트리거 추가

### Supabase 마이그레이션 (완료)
```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

---

## 2026-06-11

### 추가/변경 기능

**사이드바**
- 메뉴 탭 순서 편집 기능 (Settings2 아이콘 → ↑↓ 버튼으로 순서 변경, localStorage 저장)
- 프로젝트 바로가기: "프로젝트" 메뉴 하단 접힘/펼침 서브리스트
- 프로젝트 바로가기 순서 편집 (↑↓ 버튼)
- 프로젝트 바로가기 즐겨찾기 삭제/복원 (X 버튼으로 숨기기, 편집 모드에서 복원)
- Hydration mismatch 수정: localStorage 읽기를 useEffect로 이전

**칸반보드 요약 바**
- 긴급(urgent) · 높음(high) 우선순위 태스크 카운트 추가
- 헤더에 "이슈 & 기록" 페이지 링크 버튼 추가

**이슈 & 기록 페이지** (`/projects/[id]/issues`) — 신규
- 이슈 트래커 + 히스토리 노트 통합 피드
- 인라인 폼: 이슈/기록 타입 선택, 제목, 본문, 우선순위
- 필터 pill: 전체 / 열림 / 닫힘 / 기록
- Supabase `posts` 테이블 (RLS 포함) 필요

**전체 현황 페이지** (`/overview`) — 신규
- 태스크 현황 / 이슈 & 기록 뷰 탭 전환
- 태스크: 전체/기한초과/오늘마감/긴급/높음이상 필터, 프로젝트별 접힘/펼침
- 이슈 & 기록: 전체/열림/닫힘/기록 필터, 프로젝트별 접힘/펼침, 이슈 페이지 링크

**주간 리포트 페이지** (`/report`) 개선
- 레이아웃 2컬럼 (lg:grid-cols-3) — 태스크 목록 / 프로젝트별 현황
- 이번 주 이슈/기록 섹션 추가 (왼쪽 컬럼)
- 프로젝트 카드에 이슈/기록 건수 뱃지 추가

**메뉴명 변경**
- "대시보드" → "프로젝트"

### 백로그 현황 검토 (코드 분석)

기존 백로그 항목 중 이미 구현된 기능 확인:
- 우선순위 배지 ✅ (카드 배지 행)
- 우선순위별 필터 ✅ (헤더 필터 pill)
- 마감일 임박 하이라이트 ✅ (오늘/내일/기한초과 카드 색상)
- WIP limit ✅ (컬럼 설정 모달)
- 컬럼 이름 인라인 편집 ✅ (더블클릭 설정 모달)
- 완료 컬럼 자동 접기 ✅ (첫 방문 시 자동 접힘)

**남은 미구현 항목 (미적용 결정)**
| 항목 | 미적용 이유 |
|------|------------|
| 태스크 댓글/활동 로그 | 1인 사용 환경에서 즉시 필요도 낮음 |
| 반복 태스크 | 서버리스 환경에서 크론잡 필요, 복잡도 높음 |
| 파일 첨부 | Supabase Storage 별도 설정 필요, 우선순위 낮음 |
| 칸반 → 리스트 뷰 | 추후 태스크 수 증가 시 재검토 |

**Today 대시보드** (`/today`) 개선
- 빠른 추가 바: 태스크 / 일정 / 이슈/기록 탭 전환, 프로젝트 선택 드롭다운, 제목 입력 + Enter/버튼 제출
- 이슈/기록 서브 토글 (이슈 ↔ 기록 타입 선택)
- 오늘 등록된 이슈/기록 섹션 추가 (하단)
- `firstColByProject` 계산: 완료 컬럼 제외 첫 번째 컬럼 → 태스크 추가 대상

### Supabase 마이그레이션 (수동 실행 필요)
```sql
CREATE TABLE posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT DEFAULT 'issue' CHECK (type IN ('issue', 'note')),
  title TEXT NOT NULL,
  body TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD their own posts" ON posts FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```
