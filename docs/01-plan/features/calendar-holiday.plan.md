# Plan: calendar-holiday — 캘린더 공휴일 수정 (대체공휴일 제거)

> 상태: **Plan 확정** — 2026-06-25

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 현재 대체공휴일 자동 계산 로직이 잘못된 날짜를 '대체공휴일'로 표시하는 오류가 있고, 대체공휴일은 이미 date-holidays 라이브러리 자체에서 처리되어 중복 계산된다 |
| **Solution** | `buildHolidayMap()` 내 수동 대체공휴일 계산 블록(54~69번 줄)을 제거 |
| **Function UX Effect** | 잘못된 대체공휴일 표시가 사라지고, 라이브러리가 제공하는 공휴일만 정확히 표시 |
| **Core Value** | 캘린더 공휴일 정확도 향상, 불필요한 수동 계산 코드 제거 |

---

## 1. 현재 문제

`src/app/(main)/calendar/page.tsx` — `buildHolidayMap()` 함수:

```typescript
// lines 54-69: 수동 대체공휴일 계산 (제거 대상)
const NO_SUBSTITUTE = new Set(['근로자의 날', '제헌절'])
for (const key of Object.keys(map).sort()) {
  if (NO_SUBSTITUTE.has(map[key])) continue
  const [ky, km, kd] = key.split('-').map(Number)
  const dow = new Date(ky, km - 1, kd).getDay()
  if (dow !== 0 && dow !== 6) continue

  const sub = new Date(ky, km - 1, kd + 1)
  while (sub.getDay() === 0 || sub.getDay() === 6 || map[buildHolidayKey(sub)]) {
    sub.setDate(sub.getDate() + 1)
  }
  map[buildHolidayKey(sub)] = '대체공휴일'
}
```

**문제점:**
- `date-holidays` 라이브러리 (`h.type === 'public'`)가 이미 대체공휴일을 포함해 반환
- 위 코드가 중복으로 추가 계산해 잘못된 날짜에 '대체공휴일' 표시

---

## 2. 변경 내용

**파일 1개, 16줄 제거:**

| 파일 | 변경 |
|------|------|
| `src/app/(main)/calendar/page.tsx` | `buildHolidayMap()` 내 대체공휴일 계산 블록(lines 54-69) 제거 |

변경 후 `buildHolidayMap()`은 `return map` 바로 앞에서 함수를 종료.

---

## 3. 검증 포인트

- 2025년, 2026년 공휴일 목록이 정상 표시되는지 브라우저에서 확인
- 이전에 잘못 표시되던 '대체공휴일' 날짜가 일반 날짜로 표시되는지 확인
- 설날·추석 연휴, 근로자의 날, 제헌절이 여전히 정상 표시되는지 확인

---

## 4. 범위 외 (하지 않는 것)

- 공휴일 데이터 소스 교체 (date-holidays 라이브러리 유지)
- 사용자 정의 공휴일 기능 (미구현 유지)
- 공휴일 표시 UI 스타일 변경
