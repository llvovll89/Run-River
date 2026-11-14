# Android 오프라인 앱 개발

2026-11-14: 최신 main의 화면·오프라인 저장·복구 기능을 Capacitor 8.6.2 앱 기반과 통합했다. 이전 Android PR #2의 앱 프로젝트를 재사용하되 최신 웹 기능을 유지한다.

## 범위

- APK 안에 `mobile-dist`의 정적 화면과 JS/CSS를 넣는다. 운영 사이트를 `server.url`로 여는 구조가 아니다.
- 웹 서버 페이지와 인증 콜백은 그대로 유지하고, 모바일 빌드에서만 홈·기록·인증 콜백을 교체한다.
- 기록 화면은 웹과 모바일이 같은 `HistoryView`를 사용한다. 모바일은 브라우저 API로 계정의 기록을 가져온다.
- 웹은 SSR 쿠키 클라이언트, 앱은 Supabase JS 클라이언트의 로컬 세션을 사용한다. 공개 키만 번들에 들어가며 서버 권한 정책을 변경하지 않는다.
- 인증 메일은 `NEXT_PUBLIC_SITE_URL`의 HTTPS 콜백으로 이동한다. 외부 브라우저에서 인증 후 앱에서 로그인한다. 딥링크 로그인은 아직 없다.
- 모바일에서는 PWA 설치 유도와 서비스 워커 등록·업데이트를 끈다. 기존 웹 PWA는 유지한다.

## 실행

Node.js 22+, JDK 21, Android SDK Platform 36 및 Build Tools 36이 필요하다.

```powershell
npm.cmd ci
npm.cmd run test:unit
npm.cmd run test:offline
npm.cmd run android:sync
node --test tests/mobile-browser.test.mjs
npm.cmd run android:open
npm.cmd run android:run
```

GitHub Actions는 웹 오프라인 회귀 검사, 모바일 정적 번들 검사, Android debug APK 컴파일을 실행한다. CI APK는 가짜 API 설정을 사용한 컴파일 검증용이다. 실제 계정·지도 검증용 APK는 로컬 환경 설정으로 다시 빌드한다.

`.env`, `android/local.properties`, 서명 키와 생성 웹 자산은 커밋하지 않는다. Kakao 웹 SDK를 앱에서 사용하려면 개발자 콘솔에 `https://localhost` 도메인을 등록해야 한다. API 공개 키는 APK에서 비밀이 아니다.

## 검증 경계와 다음 단계

모바일 브라우저 검사는 외부 네트워크를 차단하고 번들만 제공하여 홈 → 운동 → 기기 기록 화면 이동 및 서비스 워커 미등록을 검사한다. 기기의 GPS·화면 잠금·배터리 검사를 대신하지 않는다.

Android 운동 화면은 `NativeRun` 플러그인과 위치 foreground service를 사용한다. GPS 수집과 SQLite 기록은 WebView와 별도로 실행한다. 위치 서비스는 화면에 보이는 앱에서 위치 권한을 받은 후 시작한다. 상태 알림에서 일시정지할 수 있고, 자동 재시작·부팅 후 추적은 하지 않는다. 웹은 기존 GPS 훅을 유지한다.

네이티브 운동은 일시정지·재개·종료를 지원하고, 프로세스가 죽으면 마지막 저장 지점에서 일시정지로 복구한다. 시간은 monotonic clock으로 계산하고 5초마다 체크포인트를 저장한다. 긴 GPS 공백은 연결 거리로 추정하지 않는다. 결과를 기존 기기 기록으로 옮기기 전에는 SQLite 원본을 삭제하지 않으며 동일 운동 ID로 재시도한다. 인터벌은 아직 네이티브 기록 범위에 포함되지 않는다. 거리·시간·목적지 운동을 선택해야 한다.

지도는 아직 온라인 Kakao SDK이다. 서비스 구현·컴파일·모의 테스트는 실제 휴대폰의 GPS·화면 잠금·OS 배터리 관리 검증을 대신하지 않는다. 장시간 산행 지원 검증은 실기기 검사 후 완료로 표시해야 한다.

후속 작업은 네이티브 위치 수집과 기기 저장 → 다운로드 가능한 지도 소스와 지도 엔진 → 지역 다운로드·삭제 → 하이킹·GPX 코스 순서로 진행한다. 데이터 차단·화면 잠금·앱 전환·권한 거절·저장 공간 부족은 실제 Android 기기에서 별도로 확인해야 한다.

참고: [Capacitor Android](https://capacitorjs.com/docs/android), [Supabase JS 클라이언트](https://supabase.com/docs/reference/javascript/initializing).
