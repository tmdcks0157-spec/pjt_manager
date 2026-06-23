# Plan: markdown-notes — 이슈 기록 기능 강화 (마크다운)

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 이슈&기록(posts)의 body 필드가 일반 textarea라 코드블록·체크리스트·헤딩 같은 구조화된 메모 작성이 불가하다 |
| **Solution** | posts body를 마크다운 에디터로 교체 — 옵시디언 스타일의 라이브 프리뷰 지원 |
| **Function UX Effect** | 작성 중 마크다운이 바로 렌더링되어 보이고, 저장된 메모는 헤딩·리스트·코드블록으로 가독성 있게 표시 |
| **Core Value** | 단순 텍스트 메모에서 지식 관리 도구로 격상 — 회의록·기술 노트·체크리스트를 구조적으로 기록 |

---

## 1. 현황 분석

### 기존 코드

| 항목 | 현재 상태 |
|------|-----------|
| `posts.body` | `TEXT` 컬럼 (DB 변경 불필요) |
| `issues/page.tsx` | `<textarea>` + autoResize 패턴 |
| body 저장/조회 | 이미 구현됨 — UI만 교체 |

### 라이브러리 후보

| 라이브러리 | 특징 | 추천도 |
|-----------|------|--------|
| `@uiw/react-md-editor` | 심플, 번들 작음, SSR 주의 필요 | ⭐⭐⭐ |
| `tiptap` | ProseMirror 기반, 확장성 높음, 설정 복잡 | ⭐⭐ |
| `@milkdown/react` | 옵시디언과 유사한 UX, 비교적 신생 | ⭐⭐ |

**추천: `@uiw/react-md-editor`** — 설정 최소, SSR은 dynamic import로 해결

---

## 2. 기능 범위

### 2.1 에디터 모드

| 항목 | 상세 |
|------|------|
| 편집 | 마크다운 문법 입력 |
| 프리뷰 | 편집/프리뷰 탭 전환 또는 split 뷰 |
| 지원 문법 | 헤딩, 굵기/기울기, 리스트, 체크리스트, 코드블록, 인라인코드, 링크, 인용 |

### 2.2 뷰어 모드

| 항목 | 상세 |
|------|------|
| 저장된 메모 표시 | `react-markdown` 또는 에디터 내장 렌더러로 HTML 변환 |
| 코드 하이라이팅 | `rehype-highlight` 또는 `prism` |

### 2.3 적용 범위

| 위치 | 적용 여부 |
|------|-----------|
| 이슈&기록 (`/projects/[id]/issues`) | ✅ 적용 |
| CRM 활동 기록 body | 추후 검토 |
| 태스크 설명 필드 | 추후 검토 |

---

## 3. 파일 변경 예정

| 파일 | 변경 유형 |
|------|-----------|
| `src/app/(main)/projects/[id]/issues/page.tsx` | 수정 — textarea → MarkdownEditor |
| `src/components/ui/MarkdownEditor.tsx` | 신규 — dynamic import 래퍼 |
| `src/components/ui/MarkdownViewer.tsx` | 신규 — 저장된 내용 렌더링 |

---

## 4. 설치 예정 패키지

```bash
npm install @uiw/react-md-editor
# 또는
npm install @uiw/react-markdown-preview  # 뷰어만 필요할 때
```

---

## 5. 주의사항

- `@uiw/react-md-editor`는 SSR에서 window 참조 오류 발생 → `dynamic(() => import(...), { ssr: false })` 필수
- 기존 plain text body는 마크다운으로 그대로 렌더링 가능 (하위 호환)

---

## 6. 미포함 범위

- 이미지 업로드 (드래그&드롭)
- 태그 자동완성
- 버전 히스토리
