# Run River — Project Guide

## 프로젝트 개요
GPS 기반 러닝/걷기 트래커 PWA. Next.js 15 + React 19 + TypeScript + Supabase + Kakao Maps.
모바일 전용 (max-width: 430px). 인증 없음 (RLS 전체 허용).

## 커맨드
```
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run start    # 프로덕션 실행
```

## 환경 변수 (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_KAKAO_MAP_KEY
NEXT_PUBLIC_TMAP_KEY   # optional — T-Map 보행자 경로
```

---

## 페이지 구조
| 경로 | 파일 | 역할 |
|------|------|------|
| `/` | `src/app/page.tsx` | 지도 설정, 목표 설정, 경로 탐색 |
| `/running` | `src/app/running/page.tsx` | 실시간 GPS 트래킹 |
| `/result` | `src/app/result/page.tsx` | 세션 결과 확인 |
| `/history` | `src/app/history/page.tsx` | 기록 목록 + 통계 (서버 컴포넌트) |

---

## 핵심 타입 (src/types/index.ts)
```typescript
LatLng           { lat: number; lng: number }
ActivityType     = "running" | "walking"
RunConfig        { startPoint, endPoint, activityType, goalDistance(km)|null, goalTime(min)|null }
RunningRecord    { id, start_point, end_point, distance_km, duration_seconds, pace, activity_type, memo?, created_at }
```

---

## Supabase (src/lib/supabase.ts)
**테이블:** `running_records`
```
id, start_point(JSONB), end_point(JSONB), distance_km, duration_seconds,
pace, activity_type, memo(max 300), created_at
Index: idx_running_records_created_at DESC
```
**함수:**
```typescript
saveRunningRecord(record)        // INSERT
deleteRunningRecord(id)          // DELETE
updateRunningMemo(id, memo)      // UPDATE
getRunningHistory()              // SELECT * ORDER BY created_at DESC
```
- Browser client: `src/lib/supabase.ts`
- SSR client: `@supabase/ssr` (history 페이지)

---

## Hooks (src/hooks/)
| 훅 | 반환 | 위치 |
|----|------|------|
| `useGeolocation` | `{ position, error, isTracking, pathPoints, totalDistance, startTracking, stopTracking, pauseTracking, resumeTracking }` + `calcDistance(a,b): km` | useGeolocation.ts |
| `useCompass` | `{ heading, isSupported, needsPermission, requestPermission }` | useCompass.ts |
| `useNotification` | `{ permission, requestPermission }` | useNotification.ts |
| `useTheme` | `{ theme: "light"\|"dark", toggle }` | useTheme.ts |
| `usePWAInstall` | `{ mode, canInstall, promptInstall }` | usePWAInstall.ts |
| `usePWAUpdate` | `{ updateAvailable, applyUpdate, dismissUpdate }` | usePWAUpdate.ts |

---

## 컴포넌트
**KakaoMap.tsx** — ref: `KakaoMapHandle { panTo(latlng) }`
- window.kakao 동적 로딩, 타입: `src/types/kakao.d.ts`
- 마커: 출발(초록), 도착(주황), 미리보기(회색)
- 폴리라인: routePath(파랑 #007aff 6px), pathPoints(활동색 5px), previewLine(회색 점선)
- 도착 반경 원: 5m, 주황 #ff9f0a

**기타:** WeeklyChart(recharts), DeleteRecordButton, EditableMemo, PWAUpdateBanner, PCLanding

---

## 유틸 함수 (src/lib/utils.ts)
```typescript
formatDuration(seconds): "MM:SS" | "H:MM:SS"
formatPace(pace): "M'SS\""
calcPace(distanceKm, seconds): number
getPaceZone(pace, activityType): { label, color }
  // Running: <4:30=빠름(#ff453a), 4:30-6:30=적정(#30d158), >6:30=느림
  // Walking: <7:00=빠름, 7:00-12:00=적정, >12:00=느림
```

---

## 스토리지
- **sessionStorage:** `runConfig`(시작 전), `runResult`(결과 페이지용)
- **localStorage:** `theme`
- **Supabase:** 영구 기록

---

## 주요 로직 메모

**도착 판정:**
- 목적지: `calcDistance(position, endPoint) <= 0.005km`
- 거리 목표: `totalDistance >= config.goalDistance`
- 시간 목표: `elapsed >= config.goalTime * 60`

**경로 계산 우선순위:**
1. T-Map 보행자 경로 (`NEXT_PUBLIC_TMAP_KEY` 있을 때)
2. OSRM `/foot` 엔드포인트 (fallback)
- T-Map 좌표 순서: `startX/startY = lng/lat` (주의)

**GPS 노이즈 필터:** 0.001km 이하 이동 무시, 0.05km 이상 점프 무시

**Wake Lock:** iOS는 Screen Wake Lock API 미지원 → toast 경고만 표시

**프리셋:**
- 거리: `GOAL_PRESETS = [3, 5, 10, 21]` km
- 시간: `TIME_PRESETS = [15, 20, 30, 45, 60]` min

---

## 스타일링
CSS 변수: `--c-bg`, `--c-surface`, `--c-elevated`, `--c-border`, `--c-text-1~3`
`--c-toss-blue`(#007aff, 러닝), `--c-walk`(#34c759, 걷기), `--c-danger`(#ff453a)
`--sat`(상단 safe area), `--sab`(하단 safe area)
폰트: Pretendard (CDN)

---

## PWA (next.config.ts)
- `skipWaiting: false` — 유저 승인 후 업데이트
- dev 환경에서 SW 비활성화
- `cacheOnFrontEndNav: true`, `aggressiveFrontEndNavCaching: true`
