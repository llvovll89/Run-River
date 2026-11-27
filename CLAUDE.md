# Run River — Project Guide

## 프로젝트 개요
GPS 기반 러닝/걷기 트래커 PWA. Next.js 15 + React 19 + TypeScript + Supabase + Kakao Maps.
모바일 전용 (max-width: 430px). Supabase 로그인 선택 — 게스트는 기기(localStorage)에만 기록, `/history`·`/settings`는 로그인 필요(`src/middleware.ts`).

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
| `/history` | `src/app/history/page.tsx` | 계정 기록 목록 + 통계 (서버 컴포넌트, 로그인·온라인 필요) |
| `/local-history` | `src/app/local-history/page.tsx` | 이 기기의 운동 기록 (오프라인 가능) |
| `/maps` | `src/app/maps/page.tsx` | 오프라인 지도 지역 저장·관리 |
| `/hiking` | `src/app/hiking/page.tsx` | 하이킹 기록, GPX·KMZ 코스 |
| `/settings` | `src/app/settings/page.tsx` | 프로필·설정 (로그인·온라인 필요) |
| `/auth` | `src/app/auth/page.tsx` | 로그인 |

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
| `usePWAUpdate` | `{ justUpdated }` — 새 버전 자동 적용, 적용 직후 3초 토스트용 | usePWAUpdate.ts |

---

## 컴포넌트
**MapView.tsx** — 모든 화면의 공통 지도. ref: `MapHandle { panTo(latlng), fitPoints(points) }`
- 배경: 저장한 PMTiles 팩 → 온라인이면 OpenFreeMap(OSM) → 오프라인이면 GPS 스케치(`offlineSketch`)
- 지역 저장(`/maps`, `AreaMapSaver.tsx`): 화면에 보이는 범위의 OpenFreeMap 타일(z8–14, 최대 1200개)을 받아 기기에서 PMTiles로 묶음(`lib/areaMaps.ts`). id `area-*`, 바이트는 IndexedDB `areas`, 목록은 localStorage `rr_area_maps`. 팩 `schema`가 `openmaptiles`면 OMT 스타일로 그림
- 엔진: MapLibre(`MapLibreTrailMap.tsx`), 아이폰(WKWebView WebGL 문제)은 Leaflet 캔버스(`CanvasTrailMap.tsx` + `lib/omtCanvasRules.ts`)
- 마커: 출발(초록), 도착(주황), 미리보기 핀 / 선: routePath(예정 경로), points(기록, 활동색), course(따라갈 코스, 점선), previewLine
- 도착 반경 원 5m, 지형 음영(MapLibre 온라인만, AWS terrarium), 확대·축소 `MapControls.tsx`
- 설정·색상: `lib/mapBase.ts`. 카카오는 장소 검색·주소 변환에만 사용(`lib/kakaoServices.ts`)

**Brand.tsx** — 로고: 출발점(주황 점)에서 시작한 GPS 경로 한 줄이 8° 기울어진 R을 그림. 볼이 기둥에 닿지 않는 '열린 틈'이 기억점. `BrandIcon`(남색 #16294A 타일, 앱 아이콘과 동일), `RiverMark`(바탕 없음, 선은 `currentColor`, 점은 `--c-brand-accent` #F25C1F), 워드마크는 `public/brand/wordmark.svg`를 CSS mask로 그림. 앱 아이콘은 `npm run icons`(`scripts/brand-icon.mjs` 원본 — 웹·마스커블·iOS·Android 전부), 심볼·워드마크 SVG는 `docs/brand/`(규칙·색은 `docs/brand/README.md`). 심볼을 바꾸면 세 파일(Brand.tsx·brand-icon.mjs·generate_brand.py)을 함께 수정

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
- **localStorage:**
  - `theme` (useTheme)
  - `userProfile` (useUserProfile — Supabase 동기화 전 로컬 우선 프로필)
  - `runTuningV1` (runTuning.ts — GPS 튜닝 파라미터)
  - `pendingRunRecords` (offlineQueue.ts — 오프라인 저장 대기열)
  - `rr_growth_events`, `rr_growth_counter_*` (growthEvents.ts)
  - `rr_custom_interval` (HomePageClient — 커스텀 인터벌 입력값)
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

**GPS 노이즈 필터 (`lib/gpsFilter.ts`):** 정확도 40m 초과·0.001km 이하 이동 무시, 기준점 대비 속도 상한(러닝 25km/h, 그 외 9km/h) 초과 무시. 기준점이 30초 넘게 오래됐는데 거부되면 거리 없이 기준점만 옮김(신호 끊김 후 누적 멈춤 방지)

**자동 일시정지/재개:** 자동 정지 시 트래킹 watch를 끄고, 별도 watch로 움직임(속도 2회 연속 `autoPauseResumeSpeedMs` 이상 또는 정확도 반경·20m 이상 이동)을 감지하면 자동 재개. 수동 일시정지는 자동 재개 안 함

**완료 시트 "계속 달리기":** 넘긴 완료 사유(`dismissedCompletionsRef`)는 같은 세션에서 다시 띄우지 않음

**Wake Lock:** iOS는 Screen Wake Lock API 미지원 → toast 경고만 표시

**프리셋:**
- 거리: `GOAL_PRESETS = [3, 5, 10, 21]` km
- 시간: `TIME_PRESETS = [15, 20, 30, 45, 60]` min

---

## 스타일링
CSS 변수: `--c-bg`, `--c-surface`, `--c-elevated`, `--c-border`, `--c-text-1~3`
`--c-toss-blue`(#007aff, 러닝), `--c-walk`(#34c759, 걷기), `--c-danger`(#ff453a)
`--sat`(상단 safe area), `--sab`(하단 safe area)
폰트: Pretendard Variable — `public/fonts/PretendardVariable.woff2`를 `globals.css`의 `@font-face`로 로드. **외부 CDN의 렌더링 차단 CSS 금지** (약한 신호에서 PWA 흰 화면 원인)

---

## PWA · 오프라인
- next-pwa 미사용. 서비스 워커 원본 `worker/offline-worker.js` → `npm run build` 후 `scripts/generate-service-worker.mjs`가 `VERSION`(BUILD_ID)·`ASSETS`를 주입해 `public/sw.js` 생성
- 사전 저장: 화면 `/`, `/running`, `/result`, `/local-history`, `/maps`, `/hiking` + `_next/static` 자산 + 폰트·지도 런타임. 저장 안 한 화면은 오프라인 시 SW 안내 HTML(503)
- 인증·서버 기록·API·RSC 응답은 캐시하지 않음
- 등록: `OfflineSetup.tsx` (production만, 홈 하단에 준비 상태·빌드 버전 표시)
- **업데이트는 자동** (`usePWAUpdate`): 업데이트 배너 없음. 실행 직후 5초 내 발견 시 즉시 새로고침 + "새 버전으로 업데이트했어요" 토스트, 사용 중 발견 시 앱을 백그라운드로 보낼 때 적용. `/running` 화면이거나 `rr_active_run`이 남아 있으면 적용 보류
- 빌드 버전: `next.config.ts`가 `NEXT_PUBLIC_APP_VERSION`(KST 빌드 시각 · 커밋 7자리) 주입
- 네이티브(Capacitor): `npm run build:mobile` → 정적 export `mobile-dist`, SW 미사용
- 검증: `npm run test:unit`, `npm run test:offline` (Playwright Chromium·WebKit)
