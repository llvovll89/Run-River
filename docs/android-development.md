# Android 개발 / 설치 검증

## 현재 단계

Capacitor 8.6.2와 Android 프로젝트를 추가했다. 앱 UI는 `mobile-dist`에서 APK에 포함되며 `server.url`로 운영 사이트를 열지 않는다. 이 PR은 앱 실행 기반 단계다. **백그라운드 GPS 서비스, 네이티브 기록 저장, 지도 다운로드는 아직 구현하지 않았다.**

## 요구 환경

- Node.js 22 이상, JDK 21, Android Studio 2025.2.1 이상
- Android SDK Platform 36 및 Android Studio가 요구하는 SDK Build Tools
- 실제 Android 7.0(API 24) 이상 기기와 USB 디버깅
- 프로젝트의 `.env` 또는 `.env.local`에 기존 공개 API 설정
- 카카오 JavaScript SDK 사용을 위해 카카오 개발자 콘솔의 Web 플랫폼 도메인에 앱 origin `https://localhost` 등록 필요. 실제 기기에서 허용 여부 확인. 지도 키를 APK에서 비밀로 유지할 수는 없다.

공식 문서: [Capacitor 환경](https://capacitorjs.com/docs/getting-started/environment-setup), [Android](https://capacitorjs.com/docs/android).

## 명령

Windows PowerShell에서는 실행 정책 변경 없이 `npm.cmd`, `npx.cmd`를 사용할 수 있다.

```powershell
npm.cmd ci
npm.cmd run build             # 기존 서버 기반 웹 빌드
npm.cmd run android:sync      # 모바일 정적 빌드 + Android에 복사
npm.cmd run android:open      # Android Studio에서 열기
npm.cmd run android:run       # 기기 선택·설치·실행 (SDK 필요)
```

Android Studio에서 Gradle JDK를 21로 지정한다. `android/local.properties`의 sdk.dir, 서명 키, 환경 파일, 생성 웹 자산은 Git에 넣지 않는다. 앱 ID `com.runriver.app`은 스토어 배포 전 소유자와 최종 확정한다.

## 웹과 모바일 경계

- `scripts/build-mobile.mjs`는 `.mobile-build`에 소스를 복사한다. 원본 소스를 잠시 이동하거나 삭제하지 않는다. 웹 빌드와 모바일 빌드가 서로의 서버 라우트를 바꾸지 않는다.
- 모바일만 `output: export`, `trailingSlash`, 이미지 최적화 해제, `NEXT_PUBLIC_NATIVE_APP=1`을 사용한다. PWA 서비스 워커는 앱에 포함하지 않는다.
- 모바일 홈은 Suspense로 감싸 정적 내보내기를 지원한다.
- 모바일 기록 페이지는 기존 `HistoryView`와 브라우저 데이터 API를 사용한다. 서버 쿠키·미들웨어는 패키지 안에서 실행할 수 없다. 서버의 RLS / 데이터 권한은 그대로 적용된다.
- 모바일 인증은 Supabase 일반 JS 클라이언트의 로컬 세션을 사용한다. 기존 웹은 SSR 쿠키 클라이언트를 유지한다.
- 가입 인증 메일은 `NEXT_PUBLIC_SITE_URL`(기본값: 운영 웹)의 HTTPS 콜백을 사용한다. 외부 브라우저에서 인증한 후 앱에서 이메일·비밀번호로 로그인한다. 앱 딥링크 자동 로그인은 이 단계에 포함되지 않는다. Supabase Redirect URLs에 해당 운영 콜백이 허용되어 있어야 한다.
- 지도 SDK·지도 이미지·CDN 폰트·서버 기록 조회는 여전히 네트워크를 사용할 수 있다. UI를 패키지에 넣었다는 것만으로 오프라인 지도나 배경 추적이 완성되지는 않는다.

## 자동 검사와 실기기 검사

GitHub Actions는 웹 빌드와 모바일 정적 빌드, Android debug APK 컴파일을 검사한다. `android-compile-check` 아티팩트는 **가짜 CI API 설정**으로 만든 컴파일 검증용이며 실제 로그인·지도 테스트용이 아니다. 실제 테스트는 로컬 설정으로 `android:sync` 후 빌드한다.

다음 항목은 실제 기기에서 확인 후 PR을 ready로 전환한다.

- [ ] 앱 설치·콜드 스타트, 홈 → 러닝 → 결과 → 홈 이동
- [ ] 이메일·비밀번호 로그인, 종료 후 다시 열어 로그인 유지
- [ ] 기록 조회·삭제 반영, 설정과 로그아웃
- [ ] 위치 권한 허용·거절과 포그라운드 좌표 수신
- [ ] 인터넷을 끊은 뒤 재실행해 번들 화면 열림 확인
- [ ] 기존 웹 인증과 기록 화면 회귀 확인

이 단계에서는 화면 잠금 중 GPS 기록을 보장하지 않는다. 다음 PR에서 네이티브 서비스와 영구 저장을 연결한 뒤 별도 검증한다.

### 이번 환경에서 확인한 결과

- 로컬 웹 프로덕션 빌드, 모바일 정적 내보내기, Capacitor Android 자산 복사 성공.
- 브라우저에서 외부 네트워크 요청을 차단하고 패키지용 정적 파일만 제공했을 때 홈 → 거리 목표 → 러닝 이동 성공. 모의 GPS 좌표 이동에 따라 거리 0.00 → 0.01km 갱신 확인. 이는 브라우저 모의 테스트이며 실제 Android GPS·백그라운드 검증을 대신하지 않는다.
- 현재 로컬 환경의 Supabase 주소에 대한 읽기 전용 연결 확인은 DNS `ENOTFOUND`로 실패했다. 실제 계정 로그인·기록 조회 검증에는 유효한 프로젝트 연결이 필요하다. 서버 설정이나 DB는 변경하지 않았다.
- 기존 러닝 페이지는 runConfig가 sessionStorage에 남아 있으면 새로고침 때 복구 스냅샷보다 새 운동 시작을 우선한다. 재시작 후 복구는 4단계에서 네이티브 영구 저장과 함께 수정·검증해야 한다. 현재 복구가 보장된다고 취급하지 않는다.
