# 🏃 Run-River 개발 진행 리포트

## 다음 세션 이어하기 메모 — 2026-11-27 (오후: 전체 코드리뷰 반영)

- 현재 브랜치: `main`. 마지막 완료 커밋: `ee84fce` (#28).
- 전체 코드(약 16k줄)를 4개 영역(GPS·러닝 / 기록 저장·인증 / 홈·경로 / 지도·PWA)으로 나눠 리뷰하고, 확인된 버그를 심각도 순으로 PR 5개에 나눠 반영했다.
- [PR #25](https://github.com/llvovll89/Run-River/pull/25) GPS·러닝 핵심
  - GPS가 잠깐 끊긴 뒤 거리 누적이 영구히 멈추던 문제: 기준점 대비 고정 50m 상한 제거, 경과 시간 기반 속도(러닝 25km/h·그 외 9km/h)로만 판정. 기준점이 30초 넘게 오래됐는데 거부되면 거리 없이 기준점만 이동 (`src/lib/gpsFilter.ts`)
  - 완료 시트 "계속 달리기" 직후 1초 만에 완료가 다시 뜨던 문제: 넘긴 사유를 `dismissedCompletionsRef`에 기록
  - 자동 일시정지 후 자동 재개가 없던 문제(기본값 ON): 자동 정지 중에만 별도 watch로 움직임 감지 → 자동 재개. 수동 일시정지는 제외
- [PR #26](https://github.com/llvovll89/Run-River/pull/26) 보안·데이터
  - 로그인 `next` 오픈 리다이렉트(`/%09/evil.com`, `/\evil.com`, `/.//evil.com`): URL 파싱으로 같은 출처만 허용 (`src/lib/safeRedirect.ts`, callback·auth·middleware 공통)
  - 오프라인 기록이 업로드한 날짜로 저장되던 문제: payload에 `created_at`(운동 종료 시각 `finishedAt`) 포함
  - 웹에서 하이킹 시작이 복구할 운동(`rr_active_run`)을 덮어쓰던 문제
  - 지역 지도 저장 실패·취소 후에도 worker가 계속 받던 문제 (내부 AbortController)
  - 날짜를 UTC로 묶던 문제: `dayKey()`(Asia/Seoul)로 주간·월간 차트·연속 일수·배지·CSV, 서버 컴포넌트 시각 표시 `timeZone: Asia/Seoul`
- [PR #27](https://github.com/llvovll89/Run-River/pull/27) 중간 항목
  - 홈 경로: 지점 변경 시 이전 경로 비움, 초기화 시 로딩 고착 해제, 10초 timeout, 늦게 온 역지오코딩 무시
  - **도보 경로 서버 교체**: OSRM 데모(`router.project-osrm.org`)는 foot 요청에도 자동차 결과(시청→광화문 1,422m·131초) → FOSSGIS `routing.openstreetmap.de/routed-foot`(1,182m·945초). 무료·키 불필요, 이용 조건: 초당 1회·대량 사용 금지·출처 표기, 가용성 보장 없음(DEMO)
  - 경로 이탈 판정을 꼭짓점 → 선분 거리로, 재개 시 Wake Lock 재획득, 로그아웃 시 `userProfile`·`runTuningV1` 삭제, 웹 지도 목록이 `getAll()`로 지도 바이트까지 읽던 문제(`getAllKeys()` + `rr_map_meta_*`)
  - `claim_legacy_records`·`count_unclaimed_legacy_records` 제거, insert 정책 `user_id = auth.uid()`, `user_id` 기본값 `auth.uid()`. **Supabase에 마이그레이션 `20261127070000_remove_legacy_claim.sql` 적용 완료**(사용자 실행, 주인 없는 기록 0건 확인)
  - `.claude/settings.local.json` git 추적 해제 + `.gitignore`
- [PR #28](https://github.com/llvovll89/Run-River/pull/28) 낮은 항목: GPX 다중 `<trkseg>`·트랙 이름 우선, 평균 페이스를 총 시간/총 거리로, 지도 저장 후 목록 기록 실패 시 IDB 롤백, SW 설치 실패 시 부분 캐시 삭제, MapLibre 전역 protocol 팩 해제, 러닝 화면 언마운트 정리 분리, 인터벌 진행 상태 복구 스냅샷 저장, 경로 결과에 "© OpenStreetMap 기여자 · FOSSGIS · 지도 수정" 출처 표기
- [PR #29](https://github.com/llvovll89/Run-River/pull/29) CI: android job이 Robolectric jar를 Maven Central에서 받다가 429로 반복 실패 → `~/.m2/repository/org/robolectric` 캐시. 그래도 실패하면 빈 커밋 push로 재실행(로컬 gh 토큰은 `gh run rerun` 403)
- 검증: `tsc`, `test:unit` 30, `test:offline` 5(Chromium·WebKit), `maps-browser`·`mobile-browser` 3, `next build`, CI web·android·ios 통과. GPX 파서는 xmldom 스크립트로 확인. GPS·자동 재개는 실기기 검증 전.
- 문서: `CLAUDE.md`의 GPS 노이즈 필터·자동 일시정지/재개·완료 시트·경로 계산(T-Map 미구현) 설명 갱신.
- 주의: `.claude/settings.local.json`이 브랜치 전환·`reset --hard`·pull 중 두 번 지워져 세션 스냅샷(15:27)에서 복구함. 이제 main에서도 ignore라 재발하지 않음. 그 이후 추가된 권한 규칙이 있었다면 빠졌을 수 있음.

### 다음 작업 후보

1. iPhone 실기기 확인: 터널·고가 밑 통과 후 거리 증가, 목표 달성 → "계속 달리기", 신호등 자동 일시정지 → 자동 재개, 도보 경로 시간이 걷기 속도로 나오는지
2. 인터벌 카운트다운을 벽시계 기반으로 (화면 꺼짐 동안 tick이 멈춰 전환이 늦어짐)
3. 네이티브(Swift/Java) 운동에 목표·도착 감지 추가 (안내 문구는 지원한다고 되어 있음)
4. 서비스로 키울 경우 경로 서버를 T-Map 보행자 API 또는 자체 OSRM으로 (FOSSGIS는 상업 이용 조건 미확인·가용성 보장 없음)
5. 오전 메모의 남은 후보: 실기기 홈 화면 아이콘, 상표 검색, 실제 회원가입·업로드 확인, 통계·설정 디자인 점검

---

## 이전 이어하기 메모 — 2026-11-27 (오전: 브랜드 로고)

- 현재 브랜치: `main`. 마지막 완료 커밋: `a850326`.
- [PR #23](https://github.com/llvovll89/Run-River/pull/23): 새 브랜드 로고. 이름은 Run River 유지(온길·Trailine 후보와 비교 후 사용자 선택).
  - 심볼: 주황 출발점에서 시작한 GPS 경로 한 줄이 8° 기울어진 R을 그림. 볼이 기둥에 닿지 않는 '열린 틈'이 기억점
  - 탐색: A 스위치백 트레일(작은 크기에서 S로 읽혀 탈락), B 보폭+봉우리(흔한 삼각형 조합이라 탈락), C 경로 R을 4회 다듬어 선택
  - 워드마크: Pretendard Bold를 8° 기울인 윤곽선(`public/brand/wordmark.svg`, CSS mask)
  - 컬러: River Navy `#16294A`, Trailhead Orange `#F25C1F`(출발점 전용), Mist `#F4F6F9`, Night `#0B1220`, Slate `#5B6B82`
  - 아이콘: 웹 any·마스커블, apple-touch, favicon, iOS 1024(Capacitor 기본 아이콘이었음), Android 일반·원형·적응형(배경 `#16294A`, 예전 아이콘이었음) 전부 교체. 원본은 `scripts/brand-icon.mjs`, `npm run icons`로 재생성
  - 홈 브랜드 버튼은 유리 테두리 없이 아이콘 타일 44px, 다크 지도에서는 얇은 테두리
  - 심볼·워드마크 SVG, 생성 스크립트(`generate_brand.py`, fonttools 필요), 사용 규칙: `docs/brand/`
- 심볼을 바꾸면 `Brand.tsx`·`scripts/brand-icon.mjs`·`docs/brand/generate_brand.py` 세 곳을 함께 고친다.
- [PR #24](https://github.com/llvovll89/Run-River/pull/24): 첫 방문 때 서비스 워커의 `clients.claim()`이 `controllerchange`를 일으켜 `usePWAUpdate`가 5초 안에 페이지를 새로고침하고 "새 버전으로 업데이트했어요" 토스트를 잘못 띄우던 문제 수정. 시작 시 컨트롤러가 없었으면 첫 변경은 무시한다. WebKit `test:offline`이 이 새로고침과 경합해 간헐 실패하고, `prepare()` 실패 시 브라우저가 닫히지 않아 CI가 15분 멈추던 것도 함께 고침.
- 검증: 로컬 `tsc`·`test:unit` 20·`next build`, iPhone 13 라이트·다크·PC 스크린샷. CI web(`test:offline` 포함)·android·ios 통과. 작업 환경에서는 Playwright 브라우저 버전 불일치로 `test:offline`을 직접 돌리지 못함.

### 다음 작업 후보

1. 실기기 홈 화면 아이콘 확인: iPhone은 홈 화면에서 지우고 다시 추가해야 새 아이콘이 보임
2. 앱스토어 등록·상표 출원 전 KIPRIS·USPTO·WIPO 도형 상표 검색 (아직 안 함)
3. 실제 계정으로 회원가입(인증 메일 → `/auth/callback` 복귀)·기록 업로드 실기기 확인
4. 통계·설정 화면(로그인 필요) 디자인 세부 점검
5. 라이트 테마 iOS 상태바 남색 띠의 실기기 인상 확인

---

## 이전 이어하기 메모 — 2026-11-26

- 현재 브랜치: `main`. 마지막 완료 커밋: `af50183`. 운영 배포 확인 완료, 사용자가 iPhone에서 동작 확인함.
- [PR #18](https://github.com/llvovll89/Run-River/pull/18): 약한 신호에서 PWA 흰 화면. 원인은 렌더링을 막는 외부 CDN Pretendard CSS → 폰트를 `public/fonts`에 포함하고 서비스 워커로 사전 저장. 저장 안 한 화면(통계·설정·로그인)은 오프라인 시 안내 HTML.
- [PR #19](https://github.com/llvovll89/Run-River/pull/19): frontend-design으로 야외 가독성 중심 디자인 개선(남색 유지, 굵은 고정폭 숫자, 강줄기 진행선 `RiverProgress`, 탭 이름과 같은 화면 제목, 카드 대신 구분선 단락, 48px 버튼·15px 본문·16px 입력). 홈 시트 펼침 영역에 빌드 버전(`NEXT_PUBLIC_APP_VERSION`) 표시. `CLAUDE.md`를 실제 PWA(자동 업데이트, 배너 없음)·인증 동작에 맞게 수정. code-review xhigh 15건 반영(러닝 패널·하단 바 실측으로 지도 영역 조정, 시트 버튼 가림, 동기화 배너 훅 순서 버그, iOS 상태바 띠 등).
- [PR #20](https://github.com/llvovll89/Run-River/pull/20): 홈 목표 모드 안내 문구 제거(지도 모드만 안내), 로고만 있는 44px 브랜드 버튼, 로그인 연결 실패(`Load failed`) 안내와 오류 문구 유지.
- 로그인 전체 실패 원인: Supabase 무료 플랜 일시정지(프로젝트 도메인 NXDOMAIN). 대시보드에서 복구 후 운영 로그인 정상 응답 확인.
- [PR #21](https://github.com/llvovll89/Run-River/pull/21): `supabase-keepalive` 워크플로(3일마다 12:00 KST, secrets `SUPABASE_URL`·`SUPABASE_ANON_KEY`). 수동 실행 결과 HTTP 200 성공 확인.
- 검증: `test:unit` 20, `test:offline` 5(Chromium·WebKit), `maps-browser`·`mobile-browser` 3, CI web·android·ios 통과. 라이트·다크·iPhone SE 크기 스크린샷 점검.
- 주의: UI 문구를 바꾸면 `tests/*.mjs` 외에 `ios/App/HikingUITests`, `android/.../StaticPageRequestTest.java`도 문구를 검사한다. 로컬 gh 토큰은 secrets 등록·워크플로 수동 실행 권한이 없다(403).

### 다음 작업 후보

1. 실제 계정으로 회원가입(인증 메일 → `/auth/callback` 복귀)·기록 업로드 실기기 확인
2. 통계·설정 화면(로그인 필요) 디자인 세부 점검 — 이번에는 제목·글자 크기·섹션 라벨만 바뀜
3. 라이트 테마 iOS 상태바 남색 띠의 실기기 인상 확인

---

## 이전 이어하기 메모 — 2026-11-13

**사용자 요청으로 여기서 작업을 중단했다. 아래 다음 작업은 아직 시작하지 않았다.**

- 사용자 환경: iPhone 사용. Mac·Apple Developer Program 계정 없음. 휴대폰 USB 연결 불가. 네이티브보다 iPhone 웹앱 개선을 우선한다.
- 현재 브랜치: `main`. 마지막 완료 커밋: `3dcb96a`.
- [PR #3](https://github.com/llvovll89/Run-River/pull/3): 웹앱 오프라인 실행, GPS 거리·궤적 표시, 기기 기록 저장·복구, 원래 계정으로 재연결 동기화. 병합·운영 배포 완료.
- [PR #4](https://github.com/llvovll89/Run-River/pull/4): frontend-design 스킬로 청록색 테마·강 모양 브랜드·아이콘, 홈 목표 설정, 러닝 계기판, 결과·기록·통계·설정·로그인·데스크톱 UI 개선. 병합·운영 배포 완료.
- 운영 주소: https://run-river.vercel.app — 새 테마·아이콘·탐색·서비스 워커 제공 확인 완료.
- 검증: 단위 테스트 10건과 Chromium/WebKit 통합 시나리오 4건, CI·미리보기 배포 통과. 화면별 스크린샷, 다크 모드·320px 화면 확인. GPS·동기화 테스트는 모의 GPS와 로컬 가짜 API를 사용했다.
- 실제 iPhone 하드웨어·화면 잠금 중 연속 기록·운영 DB 저장을 검증한 것은 아니다. 로컬 Supabase 주소는 DNS 연결 실패 이력이 있어 실제 계정 동기화 점검이 우선이다.
- Android 기반은 [draft PR #2](https://github.com/llvovll89/Run-River/pull/2)에 보류 중이며 main에 병합하지 않았다. 오프라인 지도 다운로드·네이티브 백그라운드 GPS도 미구현이다.
- 기존 사용자 변경 `.claude/settings.local.json`은 수정하거나 커밋하지 않았다.
- 사용자가 승인한 Git 흐름: 최신 main → 새 브랜치 → 구현·검증 → commit → push → PR → 검사 통과 후 merge. 다음 작업 재개 시에도 이 흐름을 따른다.

### 다음 작업 우선순위

1. 실제 계정 로그인·서버 동기화 연결 점검 및 정상화
2. 운동 기록 백업·GPX 내보내기
3. 오프라인 지도 제공자·저장 허용 조건 검토 후 지역 다운로드 구현

참고: [오프라인 기능과 검증 범위](docs/offline-web.md), [디자인 방향·검토 내용](docs/ui-direction.md), [향후 네이티브 계획](docs/native-roadmap.md).

---

아래는 초기 개발 당시의 과거 리포트이며 현재 상태는 위 이어하기 메모를 우선한다.

## 📊 전체 진행률
- 전체: 10/10 완료

## ✅ 완료된 작업

### 1. Next.js 프로젝트 세팅
- 완료 시각: 2026-04-26 22:40
- 작업 내용:
  - 수동 설치 (폴더명 Run-River 대문자로 create-next-app 제한)
  - package.json, tsconfig.json, next.config.ts, tailwind.config.ts, postcss.config.js
  - src/app/layout.tsx, page.tsx (초기 버전), globals.css
  - .env.local, .gitignore
  - 설치 패키지: next, react, react-dom, @supabase/supabase-js, @supabase/ssr, typescript, tailwindcss
- 특이사항: create-next-app이 대문자 폴더명 거부 → 수동 구성

### 2. next-pwa 설정
- 완료 시각: 2026-04-26 22:42
- 작업 내용:
  - @ducanh2912/next-pwa 설치
  - next.config.ts에 withPWA 래핑 (개발 모드 비활성화)
  - public/manifest.json 생성

### 3. Supabase 클라이언트 설정
- 완료 시각: 2026-04-26 22:45
- 작업 내용:
  - src/lib/supabase.ts (createClient, saveRunningRecord, getRunningHistory)
  - supabase/schema.sql (테이블 + RLS + 인덱스)
  - activity_type 컬럼 추가 (running/walking 구분)

### 4. 카카오맵 컴포넌트 구현
- 완료 시각: 2026-04-26 22:46
- 작업 내용:
  - src/components/KakaoMap.tsx (동적 스크립트 로드)
  - 시작/도착 마커, 현재 위치 마커, 폴리라인, 도착 반경 원
  - src/types/kakao.d.ts (타입 정의)

### 5. GPS 추적 훅 구현
- 완료 시각: 2026-04-26 22:47
- 작업 내용:
  - src/hooks/useGeolocation.ts (watchPosition, 거리 계산, 노이즈 필터)
  - src/hooks/useNotification.ts (권한 요청)
  - src/lib/utils.ts (formatDuration, formatPace, calcPace)

### 6. 포인트 설정 + 출발 기능
- 완료 시각: 2026-04-26 22:48
- 작업 내용:
  - src/app/page.tsx 완전 구현
  - 러닝/워킹 타입 선택
  - 지도 클릭으로 출발/도착 포인트 설정
  - sessionStorage로 설정 전달

### 7. 실시간 러닝 화면
- 완료 시각: 2026-04-26 22:49
- 작업 내용:
  - src/app/running/page.tsx
  - 실시간 거리/시간/페이스 표시
  - 지도에 이동 경로 폴리라인

### 8. 도착 감지 + Push 알림
- 완료 시각: 2026-04-26 22:49
- 작업 내용:
  - 50m 반경 도착 감지 (running/page.tsx)
  - Web Notification API 알림
  - 도착 오버레이 UI

### 9. 결과 저장 + 결과 화면
- 완료 시각: 2026-04-26 22:50
- 작업 내용:
  - src/app/result/page.tsx
  - 거리/시간/페이스 표시
  - Supabase 저장 버튼

### 10. 히스토리 화면
- 완료 시각: 2026-04-26 22:50
- 작업 내용:
  - src/app/history/page.tsx (서버 컴포넌트)
  - 총 활동/거리/일수 요약
  - 활동별 카드 목록

## 🐛 이슈 로그
| 단계 | 이슈 | 해결 방법 |
|------|------|-----------|
| 1 | create-next-app 대문자 폴더명 거부 | 수동으로 package.json 등 구성 파일 직접 작성 |
| 4 | kakao.maps.load 타입 누락 | kakao.d.ts에 load 함수 선언 추가 |

## 📁 생성된 파일 목록
```
Run-River/
├── src/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── page.tsx           # 메인 (지도 + 포인트 설정)
│   │   ├── running/page.tsx   # 실시간 러닝
│   │   ├── result/page.tsx    # 결과 화면
│   │   └── history/page.tsx   # 히스토리
│   ├── components/
│   │   └── KakaoMap.tsx
│   ├── hooks/
│   │   ├── useGeolocation.ts
│   │   └── useNotification.ts
│   ├── lib/
│   │   ├── supabase.ts
│   │   └── utils.ts
│   └── types/
│       ├── index.ts
│       └── kakao.d.ts
├── supabase/
│   └── schema.sql
├── public/
│   └── manifest.json
├── .env.local
├── .gitignore
├── next.config.ts
├── package.json
├── postcss.config.js
├── tailwind.config.ts
└── tsconfig.json
```
