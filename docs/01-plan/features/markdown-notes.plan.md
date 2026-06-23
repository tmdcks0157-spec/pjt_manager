# Plan: markdown-notes — 옵시디언 스타일 마크다운 노트

> 업데이트: 2026-06-23 (Obsidian-like WYSIWYG 방향으로 개정)

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 이슈&기록의 body가 일반 textarea라 서식 없는 평문만 작성 가능 — 회의록·기술노트를 구조적으로 쓸 수 없다 |
| **Solution** | tiptap WYSIWYG 에디터 도입 — `**굵게**` 타이핑하면 바로 굵게 렌더링되고, `- [ ]`는 클릭 가능한 체크박스로 변환 (옵시디언 live preview와 동일한 UX) |
| **Function UX Effect** | 타이핑하는 즉시 헤딩·리스트·코드블록·체크리스트가 렌더링되어 보임 — 별도 미리보기 탭 없이 단일 창에서 완성 |
| **Core Value** | 단순 텍스트 메모에서 옵시디언과 유사한 지식 관리 도구로 격상 — body는 여전히 마크다운 TEXT로 저장해 DB 변경 없음 |

---

## 1. 현황

| 항목 | 현재 상태 |
|------|-----------|
| `posts.body` | `TEXT` 컬럼 — DB 변경 없음 |
| 에디터 | `<textarea>` + autoResize (`issues/page.tsx` line 503) |
| 뷰어 | `<p className="whitespace-pre-wrap">{post.body}</p>` (line 393-396) |

---

## 2. 라이브러리 결정

### 비교

| 라이브러리 | UX | 복잡도 | 옵시디언 유사도 |
|-----------|-----|--------|----------------|
| `@uiw/react-md-editor` | 좌(편집)/우(미리보기) 분리 | 낮음 | ⭐⭐ |
| `tiptap` | WYSIWYG — 타이핑 즉시 렌더링 | 중간 | ⭐⭐⭐⭐⭐ |
| `milkdown` | WYSIWYG + 마크다운 단축키 | 높음 | ⭐⭐⭐⭐ |

### 결정: **tiptap** + **tiptap-markdown**

- `@tiptap/react` + `@tiptap/starter-kit` — 핵심 편집 기능
- `@tiptap/extension-task-list` + `@tiptap/extension-task-item` — `- [ ]` 클릭 가능한 체크박스
- `@tiptap/extension-placeholder` — placeholder 텍스트
- `tiptap-markdown` — DB 저장/불러올 때 마크다운 ↔ tiptap JSON 변환
- `react-markdown` + `rehype-highlight` — 읽기 전용 뷰어

---

## 3. 지원 기능 (마크다운 단축키)

| 타이핑 | 변환 결과 |
|--------|-----------|
| `# ` + Space | H1 헤딩 |
| `## ` + Space | H2 헤딩 |
| `### ` + Space | H3 헤딩 |
| `**text**` | **굵게** |
| `*text*` | *기울기* |
| `- ` + Space | 불릿 리스트 |
| `1. ` + Space | 번호 리스트 |
| `- [ ]` + Space | ☐ 클릭 체크박스 |
| `` `code` `` | `인라인 코드` |
| ` ``` ` + Enter | 코드 블록 |
| `> ` + Space | 인용 블록 |
| `---` + Enter | 수평선 |

---

## 4. UX 설계

### 4.1 에디터 (작성/편집 모달)

```
┌─────────────────────────────────────────────────┐
│ 내용                                             │
├─────────────────────────────────────────────────┤
│ [B] [I] [S] │ [H1] [H2] [H3] │ [`] [```] │ [☑] [>] │
├─────────────────────────────────────────────────┤
│                                                  │
│  ## 오늘 회의 요약                               │ ← H2 렌더링
│                                                  │
│  - [x] DB 스키마 확정                            │ ← 체크된 항목
│  - [ ] API 설계 검토                             │ ← 미체크 항목
│                                                  │
│  ```js                                           │ ← 코드 블록
│  const x = 1                                     │
│  ```                                             │
│                                                  │
└─────────────────────────────────────────────────┘
```

- 툴바: 상단 고정 (B / I / H1 H2 H3 / 코드 / 코드블록 / 체크리스트 / 인용)
- 최소 높이 200px, 내용에 따라 자동 확장
- dark 모드 완전 지원

### 4.2 뷰어 (피드 카드 내 body 표시)

```
┌─────────────────────────────────────────────────┐
│  ## 오늘 회의 요약                               │ ← 헤딩 렌더링
│  ─────────────────────────────────────────────  │
│  ✓ DB 스키마 확정                               │ ← 완료 체크
│  □ API 설계 검토                               │ ← 미완료
│                                                  │
│  const x = 1   ← 코드 하이라이트               │
└─────────────────────────────────────────────────┘
```

- `react-markdown` + `rehype-highlight` 사용
- 카드 내 미리보기는 최대 3줄 표시 (`line-clamp-3`), 클릭 시 전체 표시

---

## 5. 파일 변경 계획

| 파일 | 유형 | 내용 |
|------|------|------|
| `src/components/ui/MarkdownEditor.tsx` | 신규 | tiptap 에디터 래퍼, 툴바 포함, `'use client'` |
| `src/components/ui/MarkdownViewer.tsx` | 신규 | react-markdown 뷰어, rehype-highlight |
| `src/app/(main)/projects/[id]/issues/page.tsx` | 수정 | textarea → MarkdownEditor, body text → MarkdownViewer |

---

## 6. 설치 패키지

```bash
npm install @tiptap/react @tiptap/starter-kit
npm install @tiptap/extension-task-list @tiptap/extension-task-item
npm install @tiptap/extension-placeholder
npm install tiptap-markdown
npm install react-markdown rehype-highlight rehype-sanitize
```

---

## 7. 데이터 흐름

```
[DB] posts.body (마크다운 TEXT)
        ↓ 불러오기         ↑ 저장
[MarkdownEditor]      [editor.storage.markdown.getMarkdown()]
  tiptap JSON ←→ tiptap-markdown ←→ 마크다운 TEXT
        ↓ 뷰어
[MarkdownViewer]
  react-markdown → HTML 렌더링
```

- **저장**: `editor.storage.markdown.getMarkdown()` → `posts.body`
- **불러오기**: `content: formBody` (tiptap-markdown이 마크다운 → tiptap JSON 자동 변환)
- **기존 데이터**: 기존 plain text도 마크다운으로 그대로 렌더링 가능 (하위 호환)

---

## 8. 주의사항

- tiptap은 브라우저 DOM 필요 → `issues/page.tsx`가 이미 `'use client'`이므로 dynamic import 불필요
- `@tiptap/extension-task-item` 체크박스는 `editable: false`일 때 클릭이 안 됨 → 뷰어에서는 react-markdown 사용
- tiptap 스타일: `@tailwindcss/typography` 또는 커스텀 `prose` 클래스로 처리
- `tiptap-markdown`의 `html: false` 옵션으로 XSS 방지 (HTML 삽입 차단)

---

## 9. 미포함 범위

- 이미지 업로드 (드래그&드롭)
- 위키링크 `[[페이지명]]` (옵시디언 핵심 기능이나 이 앱에 불필요)
- 버전 히스토리
- CRM 활동 기록 / 태스크 설명 적용 (추후)
