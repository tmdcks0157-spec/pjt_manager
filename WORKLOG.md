# 작업일지

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
