# 🏃 Run-River 개발 진행 리포트

## 다음 세션 이어하기 메모 — 2026-11-26

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
